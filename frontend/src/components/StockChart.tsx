"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { ChartPayload } from "@/lib/chartData";

type Props = {
  data: ChartPayload;
  up: boolean;
};

export function StockChart({ data, up }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !data?.price?.length) return;

    const accent = up ? "#34C759" : "#FF3B30";
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(60, 60, 67, 0.6)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang HK", sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(60, 60, 67, 0.08)", style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        horzLine: { labelBackgroundColor: "#007AFF" },
        vertLine: { labelBackgroundColor: "#007AFF" },
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: false, pinch: true },
    });
    chartRef.current = chart;

    const priceSeries = chart.addSeries(AreaSeries, {
      lineColor: accent,
      topColor: up ? "rgba(52, 199, 89, 0.28)" : "rgba(255, 59, 48, 0.22)",
      bottomColor: up ? "rgba(52, 199, 89, 0.02)" : "rgba(255, 59, 48, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    }) as ISeriesApi<"Area">;

    priceSeries.setData(
      data.price.map((p) => ({
        time: p.time as Time,
        value: p.value,
      }))
    );

    if (data.ma20.length) {
      const ma20 = chart.addSeries(LineSeries, {
        color: "#007AFF",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ma20.setData(data.ma20.map((p) => ({ time: p.time as Time, value: p.value })));
    }

    if (data.ma50.length) {
      const ma50 = chart.addSeries(LineSeries, {
        color: "#AF52DE",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ma50.setData(data.ma50.map((p) => ({ time: p.time as Time, value: p.value })));
    }

    // Support / resistance horizontal lines on price series
    priceSeries.createPriceLine({
      price: data.support,
      color: "#34C759",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "支撐",
    });
    priceSeries.createPriceLine({
      price: data.resistance,
      color: "#FF3B30",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "阻力",
    });

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, up]);

  return (
    <div className="chart-card">
      <div className="chart-legend" aria-hidden>
        <span>
          <i className="lg price" /> 股價
        </span>
        <span>
          <i className="lg ma20" /> MA20
        </span>
        <span>
          <i className="lg ma50" /> MA50
        </span>
        <span>
          <i className="lg support" /> 支撐
        </span>
        <span>
          <i className="lg resist" /> 阻力
        </span>
      </div>
      <div ref={wrapRef} className="chart-canvas" />
      <p className="chart-caption">近約 6 個月日線 · 虛線為支撐 / 阻力</p>
    </div>
  );
}
