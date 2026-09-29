import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("everything");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState("smart");
  const [favorites, setFavorites] = useState([]);
  const [dark, setDark] = useState(false);

  const [historyItem, setHistoryItem] = useState(null);
  const [alertItem, setAlertItem] = useState(null);
  const [detailsItem, setDetailsItem] = useState(null);

  const [savedAlerts, setSavedAlerts] = useState([]);

  // ==================================================
  // PERSISTENT DATA
  // ==================================================

  useEffect(() => {
    try {
      const savedFavorites =
        JSON.parse(localStorage.getItem("comparex-favorites")) || [];

      const alerts =
        JSON.parse(localStorage.getItem("comparex-alerts")) || [];

      setFavorites(savedFavorites);
      setSavedAlerts(alerts);
    } catch (error) {
      console.error("Local storage error:", error);
    }
  }, []);

  // ==================================================
  // SEARCH
  // ==================================================

  const handleSearch = async (value = search) => {
    if (!value.trim()) return;

    setSearch(value);
    setLoading(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/search?q=${encodeURIComponent(
          value
        )}&category=${encodeURIComponent(category)}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // FAVORITES
  // ==================================================

  const toggleFavorite = (item) => {
    const key = `${item.platform}-${item.product}`;

    setFavorites((old) => {
      const updated = old.includes(key)
        ? old.filter((value) => value !== key)
        : [...old, key];

      localStorage.setItem(
        "comparex-favorites",
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  // ==================================================
  // FILTERING
  // ==================================================

  const sortedResults = [...results].sort((a, b) => {
    if (filter === "cheap") {
      return Number(a.price || 0) - Number(b.price || 0);
    }

    if (filter === "rating") {
      return Number(b.rating || 0) - Number(a.rating || 0);
    }

    if (filter === "fast") {
      return (
        parseInt(a.delivery || "999", 10) -
        parseInt(b.delivery || "999", 10)
      );
    }

    return (
      Number(b.valueScore || 0) -
      Number(a.valueScore || 0)
    );
  });

  // ==================================================
  // RECOMMENDATION
  // ==================================================

  const recommended =
    results.find((item) => item.isRecommended) ||
    [...results].sort(
      (a, b) =>
        Number(b.valueScore || 0) -
        Number(a.valueScore || 0)
    )[0];

  // ==================================================
  // TRADE OFF
  // ==================================================

  const getTradeOff = (item) => {
    if (!item || !results.length) return "";

    const prices = results
      .map((offer) => Number(offer.price))
      .filter((price) => Number.isFinite(price));

    if (!prices.length) {
      return "A balanced option based on available comparison data.";
    }

    const cheapestPrice = Math.min(...prices);
    const priceDifference =
      Number(item.price || 0) - cheapestPrice;

    const reasons = [];

    if (priceDifference > 0) {
      reasons.push(`₹${priceDifference} more than the cheapest`);
    } else {
      reasons.push("same price as the cheapest option");
    }

    if (Number(item.rating || 0) >= 4.5) {
      reasons.push("higher rating");
    } else if (Number(item.rating || 0) >= 4.3) {
      reasons.push("good rating");
    }

    if (String(item.delivery || "").includes("1")) {
      reasons.push("faster delivery");
    }

    if (
      item.seller?.includes("Top Rated") ||
      item.seller?.includes("Verified") ||
      item.seller?.includes("Trusted")
    ) {
      reasons.push("reliable seller");
    }

    if (
      item.returnPolicy?.includes("10") ||
      item.returnPolicy?.includes("7")
    ) {
      reasons.push("return coverage");
    }

    return reasons.length
      ? reasons.join(" + ")
      : "A balanced option based on available comparison data.";
  };

  // ==================================================
  // CATEGORY
  // ==================================================

  const categoryName =
    category === "everything"
      ? "Everything"
      : category.charAt(0).toUpperCase() +
        category.slice(1);

  // ==================================================
  // OPEN DEAL
  // ==================================================

  const openDeal = (item) => {
    if (!item) return;

    if (item.dealUrl) {
      window.open(
        item.dealUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      alert(
        `${item.platform || "This platform"} ka deal link available nahi hai.`
      );
    }
  };

  // ==================================================
  // IMAGE COMPONENT
  // ==================================================

  const ProductImage = ({
    src,
    alt,
    large = false
  }) => {
    const [imageError, setImageError] = useState(false);

    if (!src || imageError) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: large ? "56px" : "30px"
          }}
        >
          📦
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={alt || "CompareX product"}
        onError={() => setImageError(true)}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          objectPosition: "center",
          padding: large ? "18px" : "6px",
          boxSizing: "border-box"
        }}
      />
    );
  };

  return (
    <div className={`app ${dark ? "dark-mode" : ""}`}>

      {/* ==================================================
          NAVBAR
      ================================================== */}

      <nav className="navbar">

        <div className="brand">
          <div className="brand-icon">C</div>

          <span>
            Compare<span className="brand-x">X</span>
          </span>
        </div>

        <div className="nav-links">

          <span
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth"
              })
            }
          >
            Home
          </span>

          <span
            onClick={() =>
              results.length &&
              setHistoryItem(recommended)
            }
          >
            Price History
          </span>

          <span
            onClick={() =>
              results.length &&
              setAlertItem(recommended)
            }
          >
            Alerts
          </span>

        </div>

        <div className="nav-actions">

          <button
            className="theme-button"
            onClick={() => setDark(!dark)}
            title="Change theme"
          >
            {dark ? "☀" : "☾"}
          </button>

          <button
            className="nav-button"
            onClick={() =>
              document
                .querySelector(".search-wrapper")
                ?.scrollIntoView({
                  behavior: "smooth"
                })
            }
          >
            Get Started
          </button>

        </div>

      </nav>

      {/* ==================================================
          HERO
      ================================================== */}

      <section className="hero">

        <div className="hero-glow glow-one"></div>
        <div className="hero-glow glow-two"></div>

        <div className="badge">
          <span>✦</span>
          YOUR PERSONAL SHOPPING BRAIN
        </div>

        <h1>
          Don't just shop.
          <br />
          <span>Shop smarter.</span>
        </h1>

        <p className="hero-description">
          Compare prices. Understand the deal.
          <br />
          Make a decision you'll feel good about.
        </p>

        {/* SEARCH */}

        <div className="search-wrapper">

          <div className="search-icon">
            ⌕
          </div>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder="What do you want to buy?"
          />

          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value)
            }
          >
            <option value="everything">
              Everything
            </option>

            <option value="shopping">
              Shopping
            </option>

            <option value="grocery">
              Grocery
            </option>

            <option value="food">
              Food
            </option>

            <option value="mobiles">
              Mobiles
            </option>

            <option value="electronics">
              Electronics
            </option>

            <option value="fashion">
              Fashion
            </option>

            <option value="shoes">
              Shoes
            </option>

            <option value="medicine">
              Medicine
            </option>

            <option value="flights">
              Flights
            </option>

            <option value="hotels">
              Hotels
            </option>

            <option value="rides">
              Rides
            </option>

          </select>

          <button onClick={() => handleSearch()}>

            {loading
              ? "Thinking..."
              : "Compare"}

            {!loading && (
              <span>→</span>
            )}

          </button>

        </div>

        {/* CATEGORIES */}

        <div className="popular">

          <span className="popular-title">
            Categories:
          </span>

          {[
            ["shopping", "🛍️ Shopping"],
            ["grocery", "🛒 Grocery"],
            ["food", "🍔 Food"],
            ["flights", "✈️ Flights"],
            ["hotels", "🏨 Hotels"],
            ["rides", "🚕 Rides"],
            ["medicine", "💊 Medicine"]
          ].map(([id, label]) => (

            <button
              key={id}
              onClick={() =>
                setCategory(id)
              }
            >
              {label}
            </button>

          ))}

        </div>

        {/* TRENDING */}

        <div className="popular">

          <span className="popular-title">
            Try:
          </span>

          {[
            "iPhone",
            "Nike Shoes",
            "Laptop",
            "Headphones",
            "Milk"
          ].map((item) => (

            <button
              key={item}
              onClick={() =>
                handleSearch(item)
              }
            >
              {item}
            </button>

          ))}

        </div>

        {/* TRUST */}

        <div className="trust-row">

          <div>
            <strong>01</strong>
            <span>Search once</span>
          </div>

          <div className="trust-divider"></div>

          <div>
            <strong>02</strong>
            <span>Compare everywhere</span>
          </div>

          <div className="trust-divider"></div>

          <div>
            <strong>03</strong>
            <span>Buy smarter</span>
          </div>

        </div>

      </section>

      {/* ==================================================
          RESULTS
      ================================================== */}

      {results.length > 0 && (

        <section className="results-section">

          <div className="demo-notice">
            <span>●</span>
            Demo comparison data
          </div>

          {/* RECOMMENDATION */}

          {recommended && (

            <div className="smart-banner">

              <div className="brain-icon">
                ✦
              </div>

              <div className="smart-text">

                <span>
                  COMPAREX RECOMMENDS
                </span>

                <h3>
                  {recommended.platform} looks like the smartest choice.
                </h3>

                <p>
                  {getTradeOff(recommended)}
                </p>

              </div>

              <div className="smart-score">

                <small>
                  VALUE
                </small>

                <strong>
                  {recommended.valueScore || 0}
                </strong>

                <span>
                  /100
                </span>

              </div>

            </div>

          )}

          {/* HEADING */}

          <div className="section-heading">

            <div>

              <p className="eyebrow">
                {categoryName.toUpperCase()} RESULTS
              </p>

              <h2>
                Options for{" "}
                <span>
                  "{search}"
                </span>
              </h2>

            </div>

            <div className="filter-buttons">

              <button
                className={
                  filter === "smart"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("smart")
                }
              >
                ✦ Smart
              </button>

              <button
                className={
                  filter === "cheap"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("cheap")
                }
              >
                ₹ Cheapest
              </button>

              <button
                className={
                  filter === "rating"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("rating")
                }
              >
                ★ Rating
              </button>

              <button
                className={
                  filter === "fast"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("fast")
                }
              >
                ⚡ Fast
              </button>

            </div>

          </div>

          {/* RESULT CARDS */}

          <div className="result-grid">

            {sortedResults.map((item, index) => {

              const isRecommended =
                item.isRecommended === true;

              const favoriteKey =
                `${item.platform}-${item.product}`;

              const isFavorite =
                favorites.includes(favoriteKey);

              return (

                <div
                  className={`deal-card ${
                    isRecommended
                      ? "best-card"
                      : ""
                  }`}
                  key={`${item.platform}-${index}`}
                >

                  {isRecommended && (
                    <div className="best-tag">
                      ✦ SMART PICK
                    </div>
                  )}

                  {/* FAVORITE */}

                  <button
                    className={`favorite ${
                      isFavorite
                        ? "liked"
                        : ""
                    }`}
                    onClick={() =>
                      toggleFavorite(item)
                    }
                  >
                    {isFavorite
                      ? "♥"
                      : "♡"}
                  </button>

                  {/* PLATFORM */}

                  <div className="platform-row">

                    <div className="platform-logo">
                      {item.platform
                        ?.charAt(0)
                        ?.toUpperCase()}
                    </div>

                    <div className="platform-info">

                      <h3>
                        {item.platform}
                      </h3>

                      <span>
                        ✓ Verified listing
                      </span>

                    </div>

                  </div>

                  {/* PRODUCT */}

                  <div className="product-box">

                    <div
                      className="product-image"
                      style={{
                        width: "76px",
                        height: "76px",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        borderRadius: "12px"
                      }}
                    >

                      <ProductImage
                        src={item.image}
                        alt={item.product}
                      />

                    </div>

                    <div className="product-info">

                      <p>
                        {item.product}
                      </p>

                      <div className="rating-row">

                        <span className="rating">
                          ★ {item.rating}
                        </span>

                        <span className="rating-text">
                          Highly rated
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* PRICE */}

                  <div className="price-section">

                    <div>

                      <span className="price-label">
                        CURRENT PRICE
                      </span>

                      <h2>
                        ₹{item.price}
                      </h2>

                    </div>

                    <div className="delivery-box">

                      <span>
                        DELIVERY
                      </span>

                      <strong>
                        🚚 {item.delivery}
                      </strong>

                    </div>

                  </div>

                  {/* EXTRA INFO */}

                  <div className="extra-info">

                    <div>
                      <span>SELLER</span>
                      <strong>
                        {item.seller}
                      </strong>
                    </div>

                    <div>
                      <span>RETURN</span>
                      <strong>
                        {item.returnPolicy}
                      </strong>
                    </div>

                    <div>
                      <span>CONDITION</span>
                      <strong>
                        {item.condition || "New"}
                      </strong>
                    </div>

                  </div>

                  {/* VALUE SCORE */}

                  <div className="value-score">

                    <div>

                      <span>
                        CompareX Value Score
                      </span>

                      <strong>
                        {item.valueScore || 0}/100
                      </strong>

                    </div>

                    <div className="score-bar">

                      <div
                        className={`score-fill ${
                          (item.valueScore || 0) >= 70
                            ? "high"
                            : ""
                        }`}
                        style={{
                          width: `${Math.min(
                            item.valueScore || 0,
                            100
                          )}%`
                        }}
                      />

                    </div>

                  </div>

                  {/* WHY THIS */}

                  <div className="why-this">

                    <div className="why-header">

                      <span>
                        ✦ WHY COMPAREX RECOMMENDS THIS
                      </span>

                    </div>

                    <div className="why-reasons">

                      {(Array.isArray(item.whyThis)
                        ? item.whyThis
                        : [item.whyThis]
                      )
                        .filter(Boolean)
                        .map((reason, reasonIndex) => (

                          <div
                            key={reasonIndex}
                            className="why-reason"
                          >

                            <span>
                              ✓
                            </span>

                            <p>
                              {reason}
                            </p>

                          </div>

                        ))}

                    </div>

                    {!item.isRecommended &&
                      recommended && (

                        <div className="tradeoff">

                          <span>
                            🤔 WHY NOT THE CHEAPEST?
                          </span>

                          <p>
                            CompareX does not rank by price alone.
                            This option can justify a small price
                            difference through rating, delivery speed,
                            seller reliability or return coverage.
                          </p>

                        </div>

                      )}

                    {item.isRecommended && (

                      <div className="tradeoff">

                        <span>
                          ⭐ COMPAREX PICK
                        </span>

                        <p>
                          Best overall value based on the available
                          comparison factors — not price alone.
                        </p>

                      </div>

                    )}

                    <div className="tradeoff">

                      <span>
                        TRADE-OFF
                      </span>

                      <p>
                        {getTradeOff(item)}
                      </p>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="card-actions">

                    <button
                      className="history-button"
                      onClick={() =>
                        setHistoryItem(item)
                      }
                    >
                      📊 History
                    </button>

                    <button
                      className="alert-button"
                      onClick={() =>
                        setAlertItem(item)
                      }
                    >
                      🔔 Alert
                    </button>

                  </div>

                  {/* VIEW DETAILS */}

                  <button
                    className="deal-button"
                    onClick={() =>
                      setDetailsItem(item)
                    }
                  >
                    View Details
                    <span>→</span>
                  </button>

                </div>

              );

            })}

          </div>

        </section>

      )}

      {/* ==================================================
          NO RESULTS
      ================================================== */}

      {!loading &&
        search.trim() &&
        results.length === 0 && (

          <section className="results-section">

            <div className="demo-notice">

              <span>●</span>

              No comparison results found for this category.

            </div>

          </section>

        )}

      {/* ==================================================
          FEATURES
      ================================================== */}

      <section className="features-section">

        <div className="section-title">

          <p className="eyebrow">
            WHY COMPAREX
          </p>

          <h2>
            Shopping, but smarter.
          </h2>

          <p>
            We don't just show you prices.
            We help you understand them.
          </p>

        </div>

        <div className="feature-grid">

          <div className="feature">

            <div className="feature-icon">
              ₹
            </div>

            <h3>
              Compare Prices
            </h3>

            <p>
              See multiple options together instead
              of opening ten different apps.
            </p>

          </div>

          <div className="feature">

            <div className="feature-icon">
              ↗
            </div>

            <h3>
              Price History
            </h3>

            <p>
              Know whether today's price is actually
              worth buying.
            </p>

          </div>

          <div className="feature">

            <div className="feature-icon">
              🔔
            </div>

            <h3>
              Price Alerts
            </h3>

            <p>
              Wait for your price instead of constantly
              checking yourself.
            </p>

          </div>

          <div className="feature">

            <div className="feature-icon">
              ✦
            </div>

            <h3>
              Smart Choice
            </h3>

            <p>
              Balance price, rating and delivery to
              find the right option.
            </p>

          </div>

        </div>

      </section>

      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer>

        <div className="footer-brand">

          <div className="brand-icon">
            C
          </div>

          <span>
            Compare<span className="brand-x">X</span>
          </span>

        </div>

        <p>
          Search once. Compare everywhere. Buy smarter.
        </p>

        <small>
          Demo comparison data. Live prices require authorized platform APIs.
        </small>

        <span className="copyright">
          © 2026 CompareX
        </span>

      </footer>

      {/* ==================================================
          PRICE HISTORY MODAL
      ================================================== */}

      {historyItem && (
  <div
    className="modal-overlay"
    onClick={() => setHistoryItem(null)}
  >
    <div
      className="modal history-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="close-modal"
        onClick={() => setHistoryItem(null)}
      >
        ×
      </button>

      <span className="eyebrow">
        PRICE HISTORY
      </span>

      <h2>{historyItem.product}</h2>

      <p className="modal-platform">
        {historyItem.platform}
      </p>

      <div className="history-current-price">
        <span>CURRENT PRICE</span>
        <strong>₹{historyItem.price}</strong>
      </div>

      <div className="history-chart">
        {[
          {
            label: "30 days ago",
            price: Math.round(
              Number(historyItem.price) * 1.12
            )
          },
          {
            label: "20 days ago",
            price: Math.round(
              Number(historyItem.price) * 1.08
            )
          },
          {
            label: "10 days ago",
            price: Math.round(
              Number(historyItem.price) * 1.04
            )
          },
          {
            label: "Today",
            price: Number(historyItem.price)
          }
        ].map((point, index, arr) => {
          const prices = arr.map((p) => p.price);
          const maxPrice = Math.max(...prices);
          const minPrice = Math.min(...prices);

          const range =
            maxPrice - minPrice || 1;

          const height =
            35 +
            ((point.price - minPrice) / range) *
              55;

          return (
            <div
              className={`chart-line ${
                index === arr.length - 1
                  ? "today"
                  : ""
              }`}
              key={point.label}
            >
              <span>₹{point.price}</span>

              <div
                style={{
                  height: `${height}%`
                }}
              />

              <small>
                {point.label}
              </small>
            </div>
          );
        })}
      </div>

      <div className="history-bottom">

        <div>
          <span>
            CURRENT
          </span>

          <strong>
            ₹{historyItem.price}
          </strong>
        </div>

        <div>
          <span>
            30-DAY HIGH
          </span>

          <strong>
            ₹
            {Math.round(
              Number(historyItem.price) * 1.12
            )}
          </strong>
        </div>

        <div>
          <span>
            CHANGE
          </span>

          <strong className="price-down">
            ↓ 10.7%
          </strong>
        </div>

      </div>

      <div className="history-note">
        <span>ⓘ</span>
        <p>
          Illustrative price history for prototype
          demonstration. Live historical data will be
          connected through authorized platform data
          sources in the production version.
        </p>
      </div>

    </div>
  </div>
)}
      {/* ==================================================
          ALERT MODAL
      ================================================== 
&& (

        <div
          className="modal-overlay"
          onClick={() =>
            setAlertItem(null)
          }
        >

          <div
            className="modal alert-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={() =>
                setAlertItem(null)
              }
            >
              ×
            </button>

            <div className="modal-big-icon">
              🔔
            </div>

            <h2>
              Set a Price Alert
            </h2>

            <p>
              We'll let you know when the price
              reaches your target.
            </p>

            <div className="alert-product">

              <strong>
                {alertItem.product}
              </strong>

              <span>
                Current price: ₹{alertItem.price}
              </span>

            </div>

            <input
              className="target-input"
              type="number"
              placeholder="Enter target price"
            />

            <button
              className="alert-confirm"
              onClick={() => {
                alert("Price alert created!");
                setAlertItem(null);
              }}
            >
              Create Price Alert →
            </button>

          </div>

        </div>

      )}

      {/* ==================================================
          PRODUCT DETAILS MODAL
      ================================================== */}

      {detailsItem && (

        <div
          className="modal-overlay"
          onClick={() =>
            setDetailsItem(null)
          }
        >

          <div
            className="modal product-details-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={() =>
                setDetailsItem(null)
              }
            >
              ×
            </button>

            {/* PRODUCT HEADER */}

            <div className="product-details-header">

              <div
                className="details-product-image"
                style={{
                  width: "180px",
                  height: "180px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderRadius: "18px",
                  background: "#f8fafc",
                  flexShrink: 0
                }}
              >

                <ProductImage
                  src={detailsItem.image}
                  alt={detailsItem.product}
                  large
                />

              </div>

              <div className="details-product-info">

                <span className="eyebrow">
                  PRODUCT DETAILS
                </span>

                <h2>
                  {detailsItem.product}
                </h2>

                <div className="details-rating">
                  ★ {detailsItem.rating}
                </div>

                <h1>
                  ₹{detailsItem.price}
                </h1>

                <p>
                  Available on{" "}
                  <strong>
                    {detailsItem.platform}
                  </strong>
                </p>

              </div>

            </div>

            {/* PRODUCT INFORMATION */}

            <div className="details-info-grid">

              <div>
                <span>DELIVERY</span>

                <strong>
                  🚚 {detailsItem.delivery}
                </strong>
              </div>

              <div>
                <span>SELLER</span>

                <strong>
                  {detailsItem.seller}
                </strong>
              </div>

              <div>
                <span>RETURN</span>

                <strong>
                  {detailsItem.returnPolicy}
                </strong>
              </div>

              <div>
                <span>CONDITION</span>

                <strong>
                  {detailsItem.condition || "New"}
                </strong>
              </div>

            </div>

            {/* VALUE SCORE */}

            <div className="details-score">

              <div>

                <span>
                  CompareX Value Score
                </span>

                <strong>
                  {detailsItem.valueScore || 0}/100
                </strong>

              </div>

              <div className="score-bar">

                <div
                  className="score-fill high"
                  style={{
                    width: `${Math.min(
                      detailsItem.valueScore || 0,
                      100
                    )}%`
                  }}
                />

              </div>

            </div>

            {/* WHY THIS */}

            <div className="details-why">

              <h3>
                ✦ Why This?
              </h3>

              {(Array.isArray(detailsItem.whyThis)
                ? detailsItem.whyThis
                : [detailsItem.whyThis]
              )
                .filter(Boolean)
                .map((reason, index) => (

                  <div
                    className="why-reason"
                    key={index}
                  >

                    <span>
                      ✓
                    </span>

                    <p>
                      {reason}
                    </p>

                  </div>

                ))}

            </div>

            {/* TRADE-OFF */}

            <div className="details-tradeoff">

              <span>
                TRADE-OFF
              </span>

              <p>
                {getTradeOff(detailsItem)}
              </p>

            </div>

            {/* VIEW ACTUAL DEAL */}

            <button
              className="deal-button"
              onClick={() =>
                openDeal(detailsItem)
              }
            >
              View Deal on {detailsItem.platform}
              <span>↗</span>
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;