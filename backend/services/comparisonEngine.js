function normalizePrice(value) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[₹$,\s]/g, "").replace(/INR|Rs\.?/gi, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function getPriceScore(item, offers) {
  const prices = offers
    .map((offer) => normalizePrice(offer.price))
    .filter((price) => price !== null && price > 0);

  const price = normalizePrice(item.price);

  if (!prices.length || price === null) return 0;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (maxPrice === minPrice) return 40;

  return Math.round(
    40 - ((price - minPrice) / (maxPrice - minPrice)) * 40
  );
}

function getDeliveryMinutes(delivery) {
  if (!delivery) return 999999;

  const text = String(delivery).toLowerCase();

  let totalMinutes = 0;

  const days = text.match(/(\d+(?:\.\d+)?)\s*(day|days|d)/);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|h)/);
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*(minute|minutes|min|mins|m)/);

  if (days) totalMinutes += Number(days[1]) * 1440;
  if (hours) totalMinutes += Number(hours[1]) * 60;
  if (minutes) totalMinutes += Number(minutes[1]);

  if (totalMinutes > 0) return totalMinutes;

  const range = text.match(/(\d+)\s*-\s*(\d+)/);

  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);

    if (text.includes("day")) return ((first + second) / 2) * 1440;
    if (text.includes("hour") || text.includes("hr")) {
      return ((first + second) / 2) * 60;
    }
  }

  return 999999;
}

function getDeliveryScore(item, offers) {
  const times = offers
    .map((offer) => getDeliveryMinutes(offer.delivery))
    .filter((time) => time !== 999999);

  const currentTime = getDeliveryMinutes(item.delivery);

  if (!times.length || currentTime === 999999) return 0;

  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  if (maxTime === minTime) return 25;

  return Math.round(
    25 - ((currentTime - minTime) / (maxTime - minTime)) * 25
  );
}

function getSellerScore(item) {
  const seller = String(item.seller || "").toLowerCase();

  if (
    seller.includes("top") ||
    seller.includes("verified") ||
    seller.includes("trusted")
  ) {
    return 10;
  }

  if (seller.includes("official")) return 10;

  if (seller.includes("seller")) return 7;

  return 5;
}

function getReturnScore(item) {
  const policy = String(item.returnPolicy || "").toLowerCase();

  if (policy.includes("10")) return 10;
  if (policy.includes("7")) return 8;
  if (policy.includes("15")) return 10;
  if (policy.includes("return")) return 6;

  return 3;
}

function getRatingScore(item) {
  const rating = Number(item.rating);

  if (!Number.isFinite(rating)) return 0;

  return Math.round((rating / 5) * 10);
}

/*
  Generic priority weights.

  Every product/category uses the same engine.
  No iPhone/headphone/mobile-specific logic.
*/

const PRIORITY_WEIGHTS = {
  smart: {
    price: 40,
    rating: 25,
    delivery: 15,
    seller: 10,
    return: 10
  },

  cheap: {
    price: 65,
    rating: 15,
    delivery: 10,
    seller: 5,
    return: 5
  },

  rating: {
    price: 15,
    rating: 60,
    delivery: 10,
    seller: 10,
    return: 5
  },

  fast: {
    price: 15,
    rating: 15,
    delivery: 60,
    seller: 5,
    return: 5
  },

  balanced: {
    price: 30,
    rating: 30,
    delivery: 20,
    seller: 10,
    return: 10
  }
};

function getPriorityWeights(priority = "smart") {
  return PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.smart;
}

function calculateValueScore(item, offers, priority = "smart") {
  const weights = getPriorityWeights(priority);

  const priceScore = getPriceScore(item, offers);
  const ratingScore = getRatingScore(item);
  const deliveryScore = getDeliveryScore(item, offers);
  const sellerScore = getSellerScore(item);
  const returnScore = getReturnScore(item);

  const baseScore =
    priceScore +
    ratingScore +
    deliveryScore +
    sellerScore +
    returnScore;

  /*
    Convert the old component scores into normalized percentages,
    then apply the selected user's priority weights.
  */

  const normalizedPrice = priceScore / 40;
  const normalizedRating = ratingScore / 10;
  const normalizedDelivery = deliveryScore / 25;
  const normalizedSeller = sellerScore / 10;
  const normalizedReturn = returnScore / 10;

  const weightedScore =
    normalizedPrice * weights.price +
    normalizedRating * weights.rating +
    normalizedDelivery * weights.delivery +
    normalizedSeller * weights.seller +
    normalizedReturn * weights.return;

  return Math.round(weightedScore);
}

function generateWhyThis(item, priority = "smart") {
  const price = normalizePrice(item.price);
  const rating = Number(item.rating);
  const delivery = item.delivery || "delivery time unavailable";

  if (priority === "cheap") {
    return `Prioritizes lower price while still considering rating, delivery, seller and returns.`;
  }

  if (priority === "rating") {
    return `Prioritizes product rating while still considering price, delivery, seller and returns.`;
  }

  if (priority === "fast") {
    return `Prioritizes faster delivery while still considering price, rating, seller and returns.`;
  }

  if (priority === "balanced") {
    return `Balances price, rating, delivery, seller reliability and return policy.`;
  }

  return `Balanced choice considering price${price ? ` (₹${price})` : ""}, ${rating || "N/A"} rating and ${delivery} delivery.`;
}

function generateWhyNotCheapest(item, offers) {
  const prices = offers
    .map((offer) => normalizePrice(offer.price))
    .filter((price) => price !== null);

  const currentPrice = normalizePrice(item.price);

  if (!prices.length || currentPrice === null) return null;

  const cheapestPrice = Math.min(...prices);

  if (currentPrice === cheapestPrice) {
    return "This is currently the cheapest available offer.";
  }

  const difference = currentPrice - cheapestPrice;

  return `Costs ₹${difference} more than the cheapest option, which may be justified by its rating, delivery, seller reliability or return policy.`;
}

function compareOffers(offers, priority = "smart") {
  return offers.map((offer) => {
    const valueScore = calculateValueScore(offer, offers, priority);

    return {
      ...offer,
      valueScore,
      whyThis: generateWhyThis(offer, priority),
      whyNotCheapest: generateWhyNotCheapest(offer, offers)
    };
  });
}

module.exports = {
  normalizePrice,
  getDeliveryMinutes,
  getPriceScore,
  getDeliveryScore,
  getSellerScore,
  getReturnScore,
  getRatingScore,
  getPriorityWeights,
  calculateValueScore,
  generateWhyThis,
  generateWhyNotCheapest,
  compareOffers,
  PRIORITY_WEIGHTS
};