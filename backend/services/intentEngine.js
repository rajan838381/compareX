// ============================================================
// CompareX - Generic Intent Engine
// ============================================================

// ------------------------------------------------------------
// 1. Convert amount + unit into actual number
// ------------------------------------------------------------

function parseAmount(value, unit = "") {
  let amount = Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(amount)) {
    return null;
  }

  const normalizedUnit = String(unit).toLowerCase();

  if (normalizedUnit === "k" || normalizedUnit === "thousand") {
    amount = amount * 1000;
  }

  if (
    normalizedUnit === "lakh" ||
    normalizedUnit === "lac"
  ) {
    amount = amount * 100000;
  }

  return amount;
}


// ------------------------------------------------------------
// 2. Extract budget
// Supports:
// 3000
// 3k
// 2.5k
// ₹3k
// Rs 3k
// under 3000
// under 3k
// below 5k
// up to 50k
// ------------------------------------------------------------

function extractBudget(text) {
  const patterns = [
    /\b(?:under|below|less\s+than|within|upto|up\s+to|maximum|max|budget)\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(k|thousand|lakh|lac)?\b/i,

    /(?:₹|rs\.?|inr)\s*([\d,.]+)\s*(k|thousand|lakh|lac)?\b/i,

    /\bbudget\s+(?:of\s+)?([\d,.]+)\s*(k|thousand|lakh|lac)?\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const amount = parseAmount(match[1], match[2]);

      if (amount !== null) {
        return amount;
      }
    }
  }

  return null;
}


// ------------------------------------------------------------
// 3. Detect user priorities
// ------------------------------------------------------------

function detectPriorities(text) {
  const priorities = [];


  // Price priority
  if (
    /\b(cheap|cheapest|lowest\s+price|low\s+price|affordable|budget|save\s+money|economical)\b/i.test(
      text
    )
  ) {
    priorities.push("price");
  }


  // Rating priority
  if (
    /\b(best\s+rated|highest\s+rated|top\s+rated|good\s+rating|great\s+rating|high\s+rating|rating|ratings|highly\s+rated)\b/i.test(
      text
    )
  ) {
    priorities.push("rating");
  }


  // Delivery priority
  if (
    /\b(fast|fastest|quick|quickest|urgent|early|fast\s+delivery|quick\s+delivery|faster\s+delivery)\b/i.test(
      text
    )
  ) {
    priorities.push("delivery");
  }


  // Seller priority
  if (
    /\b(trusted\s+seller|reliable\s+seller|verified\s+seller|trusted\s+seller|seller)\b/i.test(
      text
    )
  ) {
    priorities.push("seller");
  }


  // Return priority
  if (
    /\b(return|returns|easy\s+return|better\s+return|return\s+policy|easy\s+returns|better\s+returns)\b/i.test(
      text
    )
  ) {
    priorities.push("return");
  }


  // Remove duplicates
  return [...new Set(priorities)];
}


// ------------------------------------------------------------
// 4. Decide scoring mode
// ------------------------------------------------------------

function detectMode(priorities) {
  if (priorities.length === 0) {
    return "smart";
  }


  if (priorities.length === 1) {
    if (priorities[0] === "price") {
      return "cheap";
    }

    if (priorities[0] === "rating") {
      return "rating";
    }

    if (priorities[0] === "delivery") {
      return "fast";
    }
  }


  // Multiple priorities
  return "balanced";
}


// ------------------------------------------------------------
// 5. Clean product query
// ------------------------------------------------------------

function cleanProductQuery(text) {
  let query = String(text || "");


  // Remove budget phrases
  query = query.replace(
    /\b(under|below|less\s+than|within|upto|up\s+to|maximum|max|budget)\s*(?:₹|rs\.?|inr)?\s*[\d,.]+\s*(?:k|thousand|lakh|lac)?\b/gi,
    " "
  );


  // Remove currency amounts
  query = query.replace(
    /(?:₹|rs\.?|inr)\s*[\d,.]+\s*(?:k|thousand|lakh|lac)?\b/gi,
    " "
  );


  // Remove standalone amounts like 3k
  query = query.replace(
    /\b[\d,.]+\s*(?:k|thousand|lakh|lac)\b/gi,
    " "
  );


  // Remove price words
  query = query.replace(
    /\b(cheap|cheapest|lowest\s+price|low\s+price|affordable|save\s+money|economical)\b/gi,
    " "
  );


  // Remove rating words
  query = query.replace(
    /\b(best\s+rated|highest\s+rated|top\s+rated|good\s+rating|great\s+rating|high\s+rating|highly\s+rated|rating|ratings)\b/gi,
    " "
  );


  // Remove delivery words
  query = query.replace(
    /\b(fast\s+delivery|quick\s+delivery|faster\s+delivery|fast|fastest|quick|quickest|urgent|early)\b/gi,
    " "
  );


  // Remove seller words
  query = query.replace(
    /\b(trusted\s+seller|reliable\s+seller|verified\s+seller|trusted|reliable|seller)\b/gi,
    " "
  );


  // Remove return words
  query = query.replace(
    /\b(easy\s+return|better\s+return|return\s+policy|easy\s+returns|better\s+returns|return|returns)\b/gi,
    " "
  );


  // Remove natural-language request words
  query = query.replace(
    /\b(i\s+need|i\s+want|i\s+am\s+looking\s+for|i'm\s+looking\s+for|im\s+looking\s+for|looking\s+for|find\s+me|show\s+me|give\s+me|get\s+me|please|can\s+you|could\s+you|help\s+me\s+find)\b/gi,
    " "
  );


  // Remove connector words
  query = query.replace(
    /\b(with|and|having|that|has|have)\b/gi,
    " "
  );


  // Clean extra spaces
  query = query
    .replace(/\s+/g, " ")
    .trim();


  return query;
}


// ------------------------------------------------------------
// 6. Main intent parser
// ------------------------------------------------------------

function parseIntent(query) {
  const originalQuery = String(query || "").trim();

  const text = originalQuery.toLowerCase();

  const budget = extractBudget(text);

  const priorities = detectPriorities(text);

  const mode = detectMode(priorities);

  const productQuery = cleanProductQuery(text);


  return {
    originalQuery: originalQuery,

    productQuery: productQuery,

    budget: budget,

    priorities: priorities,

    mode: mode,

    constraints: {
      maxPrice: budget,

      priceImportant: priorities.includes("price"),

      ratingImportant: priorities.includes("rating"),

      deliveryImportant: priorities.includes("delivery"),

      sellerImportant: priorities.includes("seller"),

      returnImportant: priorities.includes("return")
    }
  };
}


// ------------------------------------------------------------
// 7. Export
// ------------------------------------------------------------

module.exports = {
  parseAmount,
  extractBudget,
  detectPriorities,
  detectMode,
  cleanProductQuery,
  parseIntent
};