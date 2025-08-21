import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Stock {
  symbol: string;
  price: number;   // latest price
  change: number;  // percent change vs prev close
}

const SYMBOLS: string[] = ["AAPL", "MSFT", "GOOGL", "AMZN"];

function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [dataSource, setDataSource] = useState<
    "Finnhub" | "FMP" | "TwelveData" | "Demo"
  >("Demo");

  // From .env at project root: REACT_APP_FINNHUB_KEY=your_key
  const API_KEY = (process.env.REACT_APP_FINNHUB_KEY || "").trim();

  useEffect(() => {
    const fetchWithFinnhub = async () => {
      if (!API_KEY) throw new Error("no-key");
      const results = await Promise.all(
        SYMBOLS.map(async (sym) => {
          const { data } = await axios.get("https://finnhub.io/api/v1/quote", {
            params: { symbol: sym, token: API_KEY },
          });
          const price = Number(data.c);
          const prev = Number(data.pc);
          const change = prev ? ((price - prev) / prev) * 100 : 0;
          return { symbol: sym, price, change };
        })
      );
      setDataSource("Finnhub");
      return results;
    };

    const fetchWithFMP = async () => {
      const { data } = await axios.get(
        `https://financialmodelingprep.com/api/v3/quote/${SYMBOLS.join(",")}?apikey=demo`
      );
      const mapped: Stock[] = data.map((d: any) => ({
        symbol: d.symbol,
        price: Number(d.price),
        change: Number(d.changesPercentage), // already percent
      }));
      setDataSource("FMP");
      return mapped;
    };

    const fetchWithTwelveData = async () => {
      // Demo key often misses symbols; fill with fallback prices.
      const FALLBACK: Record<string, number> = {
        AAPL: 228.48,
        MSFT: 452.12,
        GOOGL: 165.39,
        AMZN: 182.77,
      };

      const out = await Promise.all(
        SYMBOLS.map(async (sym) => {
          try {
            const { data } = await axios.get("https://api.twelvedata.com/price", {
              params: { symbol: sym, apikey: "demo" },
            });
            const raw = Number(data?.price);
            const price = Number.isFinite(raw) ? raw : (FALLBACK[sym] ?? 0);
            return { symbol: sym, price, change: 0 }; // demo endpoint has no change%
          } catch {
            return { symbol: sym, price: FALLBACK[sym] ?? 0, change: 0 };
          }
        })
      );

      setDataSource("TwelveData");
      setNote("TwelveData demo in use; missing quotes filled with sample prices.");
      return out;
    };

    const DEMO: Stock[] = [
      { symbol: "AAPL", price: 228.48, change: 0.87 },
      { symbol: "MSFT", price: 452.12, change: -0.32 },
      { symbol: "GOOGL", price: 165.39, change: 0.41 },
      { symbol: "AMZN", price: 182.77, change: 1.12 },
    ];

    const run = async () => {
      setLoading(true);
      setError("");
      setNote("");
      try {
        const res = await fetchWithFinnhub();
        setStocks(res);
      } catch {
        try {
          const res = await fetchWithFMP();
          setStocks(res);
        } catch {
          try {
            const res = await fetchWithTwelveData();
            setStocks(res);
          } catch {
            setStocks(DEMO);
            setDataSource("Demo");
            setNote("Using local demo data (APIs unavailable).");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [API_KEY]);

  const filtered = stocks.filter((s) =>
    s.symbol.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-1"> Stock Dashboard</h1>
      <p className="mb-2 text-sm text-gray-600">
        Data source: <span className="font-semibold">{dataSource}</span>
      </p>
      {note && <p className="mb-4 text-xs text-gray-500">{note}</p>}

      <input
        type="text"
        placeholder="Search by symbol"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 px-3 py-2 border rounded-md w-64"
      />

      {loading && <p className="text-blue-600">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto w-full max-w-2xl">
          <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-200">
              <tr>
                <th className="py-2 px-4 text-left">Symbol</th>
                <th className="py-2 px-4 text-left">Price</th>
                <th className="py-2 px-4 text-left">Change %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const hasPrice = Number.isFinite(s.price);
                const hasChange = Number.isFinite(s.change);
                const changeClass = hasChange
                  ? s.change >= 0
                    ? "text-green-600"
                    : "text-red-600"
                  : "text-gray-500";
                return (
                  <tr key={s.symbol} className="border-t">
                    <td className="py-2 px-4">{s.symbol}</td>
                    <td className="py-2 px-4">
                      {hasPrice ? `$${s.price.toFixed(2)}` : "—"}
                    </td>
                    <td className={`py-2 px-4 font-semibold ${changeClass}`}>
                      {hasChange ? `${s.change.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Simple sample chart for the first row */}
          {filtered.length > 0 && Number.isFinite(filtered[0].price) && (
            <div className="mt-6 bg-white shadow-md p-4 rounded-lg">
              <h2 className="text-lg font-bold mb-2">
                {filtered[0].symbol} (sample chart)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={[
                    { label: "P3", price: filtered[0].price - 3 },
                    { label: "P2", price: filtered[0].price - 1 },
                    { label: "Now", price: filtered[0].price },
                  ]}
                >
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#2563eb" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!loading && !filtered.length && (
        <p className="text-gray-500">No results.</p>
      )}
    </div>
  );
}

export default App;
