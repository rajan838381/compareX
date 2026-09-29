const express = require("express");
const cors = require("cors");

const products = require("./data/products");
const {
  compareOffers,
  normalizePrice
} = require("./services/comparisonEngine");

const {
  parseIntent
} = require("./services/intentEngine");

const platforms = require("./integrations/platformRegistry");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================================================
   BASIC ROUTE
========================================================= */

app.get("/", (req, res) => {
  res.json({
    message: "CompareX Backend is working!"
  });
});

/* =========================================================
   PLATFORM ROUTE
========================================================= */

app.get("/api/platforms", (req, res) => {
  const activePlatforms = Object.values(platforms)
    .filter((platform) => platform.enabled)
    .map((platform) => ({
      name: platform.name,
      categories: platform.categories
    }));

  res.json({
    count: activePlatforms.length,
    platforms: activePlatforms
  });
});

/* =========================================================
   CATEGORY ROUTE
========================================================= */

app.get("/api/categories", (req, res) => {
  const categories = [
    {
      id: "everything",
      name: "Everything",
      icon: "🌐"
    },
    {
      id: "shopping",
      name: "Shopping",
      icon: "🛍️"
    },
    {
      id: "grocery",
      name: "Grocery",
      icon: "🛒"
    },
    {
      id: "food",
      name: "Food",
      icon: "🍔"
    },
    {
      id: "mobiles",
      name: "Mobiles",
      icon: "📱"
    },
    {
      id: "electronics",
      name: "Electronics",
      icon: "💻"
    },
    {
      id: "fashion",
      name: "Fashion",
      icon: "👕"
    },
    {
      id: "shoes",
      name: "Shoes",
      icon: "👟"
    },
    {
      id: "medicine",
      name: "Medicine",
      icon: "💊"
    },
    {
      id: "flights",
      name: "Flights",
      icon: "✈️"
    },
    {
      id: "hotels",
      name: "Hotels",
      icon: "🏨"
    },
    {
      id: "rides",
      name: "Rides",
      icon: "🚕"
    }
  ];

  res.json({
    categories
  });
});

/* =========================================================
   SMART QUERY PARSER
========================================================= */

function parseSmartQuery(query) {
  const text = query.toLowerCase();

  let budget = null;
  let priority = "smart";

  /* -----------------------------
     BUDGET
  ----------------------------- */

  const budgetPatterns = [
    /under\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /below\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /less\s*than\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /within\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /upto\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /up\s*to\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /max(?:imum)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /budget\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
    /(?:₹|rs\.?|inr)\s*([\d,]+)/i
  ];

  for (const pattern of budgetPatterns) {
    const match = text.match(pattern);

    if (match) {
      budget = Number(
        match[1].replace(/,/g, "")
      );

      break;
    }
  }

  /* -----------------------------
     USER PRIORITY
  ----------------------------- */

  if (
    /\b(best rated|highest rated|top rated|rating|ratings|good rating)\b/i.test(
      text
    )
  ) {
    priority = "rating";
  }

  if (
    /\b(fast|fastest|quick|quickest|early|urgent|delivery fast|fast delivery)\b/i.test(
      text
    )
  ) {
    priority = "fast";
  }

  if (
    /\b(cheap|cheapest|lowest price|low price|budget|affordable|cheaper)\b/i.test(
      text
    )
  ) {
    priority = "cheap";
  }

  if (
    /\b(balanced|overall|best overall|value for money|value)\b/i.test(
      text
    )
  ) {
    priority = "balanced";
  }

  /* -----------------------------
     MULTIPLE PRIORITIES
  ----------------------------- */

  const prioritySignals = [
    /\b(cheap|cheapest|lowest price|low price|budget|affordable)\b/i.test(
      text
    ),

    /\b(best rated|highest rated|top rated|rating|ratings)\b/i.test(
      text
    ),

    /\b(fast|fastest|quick|quickest|urgent|fast delivery)\b/i.test(
      text
    )
  ].filter(Boolean).length;

  if (prioritySignals >= 2) {
    priority = "balanced";
  }

  return {
    originalQuery: query,
    budget,
    priority
  };
}

/* =========================================================
   PRODUCT QUERY EXTRACTION
========================================================= */

function extractProductQuery(query) {
  let text = query.toLowerCase();

  text = text
    .replace(
      /\b(under|below|less than|within|upto|up to|max|maximun|maximum|budget)\s*(?:₹|rs\.?|inr)?\s*[\d,]+\b/gi,
      ""
    )

    .replace(
      /(?:₹|rs\.?|inr)\s*[\d,]+/gi,
      ""
    )

    .replace(
      /\b(cheap|cheapest|lowest price|low price|affordable|best rated|highest rated|top rated|rating|ratings|fast|fastest|quick|quickest|urgent|fast delivery|balanced|overall|best overall|value for money|value)\b/gi,
      ""
    )

    .replace(/\s+/g, " ")
    .trim();

  return text;
}

/* =========================================================
   DELIVERY HELPER
========================================================= */

function getDeliveryMinutes(delivery) {
  if (!delivery) return 999999;

  const text = String(delivery).toLowerCase();

  const range = text.match(
    /(\d+)\s*-\s*(\d+)/
  );

  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);

    const average =
      (first + second) / 2;

    if (text.includes("day")) {
      return average * 1440;
    }

    if (
      text.includes("hour") ||
      text.includes("hr")
    ) {
      return average * 60;
    }

    if (text.includes("min")) {
      return average;
    }
  }

  const days = text.match(
    /(\d+(?:\.\d+)?)\s*(day|days|d)/
  );

  const hours = text.match(
    /(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|h)/
  );

  const minutes = text.match(
    /(\d+(?:\.\d+)?)\s*(minute|minutes|min|mins|m)/
  );

  let total = 0;

  if (days) {
    total += Number(days[1]) * 1440;
  }

  if (hours) {
    total += Number(hours[1]) * 60;
  }

  if (minutes) {
    total += Number(minutes[1]);
  }

  return total || 999999;
}

/* =========================================================
   SEARCH ROUTE
========================================================= */

app.get("/api/search", (req, res) => {
  const rawQuery =
    (req.query.q || "").trim();

  const category =
    (req.query.category || "everything")
      .toLowerCase()
      .trim();

  const query =
    rawQuery.toLowerCase();

  console.log(
    "User searched:",
    rawQuery,
    "| Category:",
    category
  );

  /* =======================================================
     EMPTY SEARCH
  ======================================================= */

  if (!query) {
    return res.json({
      search: rawQuery,
      productQuery: "",
      category,
      results: [],
      recommendation: null,
      message:
        "Please enter something to search."
    });
  }

  /* =======================================================
     PARSE NATURAL LANGUAGE QUERY
  ======================================================= */

  const intent =
    parseIntent(rawQuery);

  const smartQuery = {
    originalQuery:
      intent.originalQuery,

    budget:
      intent.budget,

    priority:
      intent.mode,

    priorities:
      intent.priorities,

    constraints:
      intent.constraints
  };

  const productQuery =
    intent.productQuery;

  console.log(
    "Smart Query:",
    smartQuery
  );

  console.log(
    "Product Query:",
    productQuery
  );

  /* =======================================================
     MATCH PRODUCTS
  ======================================================= */

  const queryWords =
    productQuery
      .split(/\s+/)
      .filter(Boolean);

  let matchedProducts =
    products.filter((product) => {
      const productName =
        product.name.toLowerCase();

      if (!productQuery) {
        return false;
      }

      return (
        productName.includes(
          productQuery
        ) ||
        queryWords.every((word) =>
          productName.includes(word)
        )
      );
    });

  /* =======================================================
     CATEGORY FILTERING
  ======================================================= */

  if (category !== "everything") {
    const categoryPlatforms =
      Object.values(platforms)
        .filter(
          (platform) =>
            platform.enabled &&
            platform.categories.includes(
              category
            )
        )
        .map(
          (platform) =>
            platform.name
        );

    console.log(
      "Platforms for category:",
      category,
      categoryPlatforms
    );

    matchedProducts =
      matchedProducts
        .map((product) => {
          const filteredOffers =
            product.offers.filter(
              (offer) =>
                categoryPlatforms.includes(
                  offer.platform
                )
            );

          return {
            ...product,
            offers:
              filteredOffers
          };
        })

        .filter(
          (product) =>
            product.offers.length > 0
        );
  }

  /* =======================================================
     NO PRODUCT FOUND
  ======================================================= */

  if (
    matchedProducts.length === 0
  ) {
    return res.json({
      search: rawQuery,
      productQuery,
      category,
      smartQuery,
      results: [],
      recommendation: null,
      message:
        `No matching product was found for "${productQuery}".`
    });
  }

  /* =======================================================
     MULTI-PRODUCT SEARCH
     
     IMPORTANT:
     "iPhone" should compare the complete
     iPhone series.

     "iPhone 15" should compare only
     iPhone 15.
  ======================================================= */

  const isBroadIphoneSearch =
    productQuery === "iphone" ||
    productQuery === "iphone series";

  let productsToCompare;

  if (isBroadIphoneSearch) {
    productsToCompare =
      matchedProducts;
  } else {
    productsToCompare =
      [matchedProducts[0]];
  }

  console.log(
    "Products to compare:",
    productsToCompare.map(
      (product) =>
        product.name
    )
  );

  /* =======================================================
     COLLECT ALL OFFERS
  ======================================================= */

  let allOffers = [];

  productsToCompare.forEach(
    (product) => {
      if (
        !Array.isArray(
          product.offers
        )
      ) {
        return;
      }

      product.offers.forEach(
        (offer) => {
          allOffers.push({
  ...offer,

  product: product.name,

  image: product.image,

  category: product.category
});
        }
      );
    }
  );

  /* =======================================================
     AVAILABLE PRICES
  ======================================================= */

  const availablePrices =
    allOffers.map((offer) => ({
      product:
        offer.product,

      platform:
        offer.platform,

      price:
        offer.price,

      normalizedPrice:
        normalizePrice(
          offer.price
        )
    }));

  /* =======================================================
     APPLY BUDGET FILTER
  ======================================================= */

  if (
    smartQuery.budget !== null
  ) {
    allOffers =
      allOffers.filter(
        (offer) => {
          const price =
            normalizePrice(
              offer.price
            );

          return (
            price !== null &&
            price <=
              smartQuery.budget
          );
        }
      );
  }

  /* =======================================================
     NO OFFER WITHIN BUDGET
  ======================================================= */

  if (
    allOffers.length === 0
  ) {
    return res.json({
      search: rawQuery,

      productQuery,

      category,

      smartQuery,

      results: [],

      recommendation: null,

      message:
        isBroadIphoneSearch
          ? "No iPhone was found within your budget."
          : `No ${productsToCompare[0].name} offer was found within your budget.`,

      debug: {
        availablePrices
      }
    });
  }

  /* =======================================================
     SCORE OFFERS
  ======================================================= */

  const scoredOffers =
    compareOffers(
      allOffers,
      smartQuery.priority
    );

  /* =======================================================
     FINAL SORT
  ======================================================= */

  const results =
    scoredOffers
      .sort(
        (a, b) =>
          Number(
            b.valueScore || 0
          ) -
          Number(
            a.valueScore || 0
          )
      )

      .map(
        (offer, index) => ({
          ...offer,

          rank:
            index + 1
        })
      );

  /* =======================================================
     BEST RECOMMENDATION
  ======================================================= */

  const bestOffer =
    results[0];

  let recommendationReason =
    "Balanced comparison using price, rating, delivery, seller reliability and return policy.";

  if (
    smartQuery.priority ===
    "cheap"
  ) {
    recommendationReason =
      "Price was given higher priority while still considering other factors.";
  }

  if (
    smartQuery.priority ===
    "rating"
  ) {
    recommendationReason =
      "Rating was given higher priority while still considering other factors.";
  }

  if (
    smartQuery.priority ===
    "fast"
  ) {
    recommendationReason =
      "Delivery speed was given higher priority while still considering other factors.";
  }

  if (
    smartQuery.priority ===
    "balanced"
  ) {
    recommendationReason =
      "Multiple priorities were detected, so CompareX balanced price, rating, delivery, seller and returns.";
  }

  /* =======================================================
     RESPONSE
  ======================================================= */

  res.json({
    search:
      rawQuery,

    productQuery,

    category,

    smartQuery,

    results,

    recommendation: {
      product:
        bestOffer.product,

      platform:
        bestOffer.platform,

      price:
        bestOffer.price,

      rating:
        bestOffer.rating,

      delivery:
        bestOffer.delivery,

      valueScore:
        bestOffer.valueScore,

      reason:
        recommendationReason
    },

    meta: {
      scoringEngine:
        "generic-user-priority-v1",

      priority:
        smartQuery.priority,

      budget:
        smartQuery.budget,

      resultCount:
        results.length,

      productCount:
        productsToCompare.length,

      multiProductSearch:
        isBroadIphoneSearch
    }
  });
});

/* =========================================================
   SERVER
========================================================= */

const PORT = 5000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(`CompareX Backend running on port ${PORT}`);
    console.log("Backend available at: http://192.168.1.79:5000");
    console.log("Loaded platforms:", Object.keys(platforms).length);
    console.log("Scoring engine: Generic User-Priority v1");
  }
);