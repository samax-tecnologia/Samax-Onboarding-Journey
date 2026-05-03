import PDFDocument from "pdfkit";
import type {
  ComputedReport,
  ComparisonRow,
  TimeSeriesPoint,
  EfficiencyMetric,
} from "./report-compute";

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(ratio: number): string {
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(1)}%`;
}

export async function renderReportPdf(args: {
  title: string;
  createdAt: Date;
  tenantId: string;
  report: ComputedReport;
}): Promise<Buffer> {
  const { title, createdAt, tenantId, report } = args;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: { Title: title, Author: "Samax FinOps" },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const summary = report.sections.executiveSummary;
  const accent = "#5b21b6";
  const muted = "#6b7280";

  // Header
  doc.fillColor(accent).fontSize(10).text("SAMAX FINOPS", { continued: false });
  doc.moveDown(0.2);
  doc.fillColor("#111").fontSize(20).font("Helvetica-Bold").text(title);
  doc.font("Helvetica").fillColor(muted).fontSize(10);
  doc.text(
    `Tenant: ${tenantId}   •   Período: ${summary.periodLabel}   •   Gerado em ${createdAt.toLocaleString("pt-BR")}`,
  );
  doc.moveDown(0.6);
  hr(doc);
  doc.moveDown(0.6);

  // Executive summary cards
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(12).text("Resumo executivo");
  doc.moveDown(0.4);
  const cards = [
    { label: "Custo no período", value: fmtUSD(summary.totalCost) },
    { label: "Projeção do baseline", value: fmtUSD(summary.baselineProjectedCost) },
    {
      label: "Economia realizada",
      value: `${fmtUSD(summary.realizedSavings)} (${fmtPct(summary.savingsPercent)})`,
      color: summary.savingsPercent >= 0 ? "#15803d" : "#b91c1c",
    },
    {
      label: "Mudanças aplicadas",
      value: String(summary.appliedChangesCount),
    },
  ];
  drawCards(doc, cards);
  doc.moveDown(0.4);
  doc.fillColor(muted).fontSize(9).font("Helvetica").text(
    `Comparado ao baseline "${summary.baselineLabel}". Oportunidades em aberto: ${summary.openOpportunitiesCount} (${fmtUSD(summary.openOpportunitiesMonthlySavings)} / mês potencial).`,
  );
  doc.moveDown(0.6);

  // Top wins
  const topWins = report.sections.topWins ?? [];
  if (topWins.length > 0) {
    ensureSpace(doc, 60 + topWins.length * 22);
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(11).text("Top 3 ganhos do período");
    doc.moveDown(0.3);
    topWins.forEach((w, i) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#15803d").text(
        `${i + 1}. ${w.title}`,
        { continued: true },
      );
      doc.font("Helvetica").fillColor("#111").text(
        `  —  ${fmtUSD(w.realizedPeriodSavings)} no período (${fmtUSD(w.realizedMonthlySavings)} / mês)${w.scope ? `  ·  ${w.scope}` : ""}`,
      );
    });
    doc.moveDown(0.6);
  } else {
    doc.moveDown(0.2);
  }

  // Time series: actual vs projected without optimization
  if (report.sections.timeSeries && report.sections.timeSeries.length > 0) {
    ensureSpace(doc, 180);
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(12).text("Evolução: custo real vs projeção sem otimização");
    doc.moveDown(0.3);
    drawTimeSeriesChart(doc, report.sections.timeSeries);
    doc.moveDown(0.6);
  }

  // Efficiency metrics
  if (report.sections.efficiency && report.sections.efficiency.length > 0) {
    ensureSpace(doc, 60 + report.sections.efficiency.length * 18);
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(12).text("Métricas de eficiência (FOCUS)");
    doc.moveDown(0.3);
    drawEfficiencyTable(doc, report.sections.efficiency);
    doc.moveDown(0.6);
  }

  // Sections
  drawTable(doc, "Por categoria FOCUS", report.sections.byCategory);
  drawTable(doc, "Por provedor", report.sections.byProvider);
  drawTable(doc, "Top serviços (por variação)", report.sections.byService.slice(0, 10));
  drawTable(doc, "Por time", report.sections.byTeam);
  drawTable(doc, "Por produto", report.sections.byProduct);

  // Applied changes
  ensureSpace(doc, 120);
  doc.moveDown(0.4);
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(12).text("Mudanças aplicadas");
  doc.moveDown(0.3);
  if (report.sections.appliedChanges.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(muted).text("Nenhuma mudança registrada neste período.");
  } else {
    for (const c of report.sections.appliedChanges) {
      ensureSpace(doc, 40);
      const isReverted = c.status === "reverted";
      doc.font("Helvetica-Bold").fontSize(10).fillColor(isReverted ? muted : "#111").text(
        `${c.title}${isReverted ? "  [revertida]" : ""}`,
      );
      const scope = [c.scopeProvider, c.scopeService, c.scopeCategory].filter(Boolean).join(" · ");
      doc.font("Helvetica").fontSize(9).fillColor(muted).text(
        `${new Date(c.appliedAt).toLocaleDateString("pt-BR")}${c.author ? ` · ${c.author}` : ""}${scope ? ` · ${scope}` : ""}`,
      );
      doc.fillColor("#111").fontSize(10).text(
        `Estimado: ${fmtUSD(c.estimatedMonthlySavings)} / mês  •  Realizado: ${fmtUSD(c.realizedMonthlySavings)} / mês  •  No período (${c.activeMonths} mês${c.activeMonths === 1 ? "" : "es"}): ${fmtUSD(c.realizedPeriodSavings)}`,
      );
      doc.moveDown(0.4);
    }
  }
  doc.moveDown(0.4);

  // Open opportunities (top 10)
  const opps = report.sections.openOpportunities.slice(0, 10);
  ensureSpace(doc, 120);
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(12).text("Oportunidades em aberto (top 10)");
  doc.moveDown(0.3);
  if (opps.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(muted).text("Nenhuma oportunidade ativa.");
  } else {
    drawOppsTable(doc, opps);
  }

  // Baseline snapshot
  doc.moveDown(0.6);
  ensureSpace(doc, 80);
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(12).text("Baseline de referência");
  doc.moveDown(0.3);
  const bs = report.sections.baselineSnapshot;
  doc.font("Helvetica").fontSize(10).fillColor("#111").text(
    `Período: ${bs.periodStart} → ${bs.periodEnd}`,
  );
  doc.text(`Custo total: ${fmtUSD(bs.totalCost)}  •  Média mensal: ${fmtUSD(bs.monthlyAvg)}  •  Meses: ${bs.months}`);

  // Footer
  doc.moveDown(1.2);
  hr(doc);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(8).fillColor(muted).text(
    "Relatório gerado automaticamente pelo Samax FinOps. Valores em USD baseados em FOCUS billing data.",
    { align: "center" },
  );

  doc.end();
  return await done;
}

function hr(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .strokeColor("#e5e7eb")
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawCards(
  doc: PDFKit.PDFDocument,
  cards: Array<{ label: string; value: string; color?: string }>,
) {
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 8;
  const w = (pageW - gap * (cards.length - 1)) / cards.length;
  const h = 56;
  const startX = doc.page.margins.left;
  const y = doc.y;
  cards.forEach((card, i) => {
    const x = startX + i * (w + gap);
    doc.roundedRect(x, y, w, h, 6).fillColor("#f9fafb").fill();
    doc.roundedRect(x, y, w, h, 6).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(card.label, x + 10, y + 8, { width: w - 20 });
    doc.fillColor(card.color ?? "#111").font("Helvetica-Bold").fontSize(13).text(card.value, x + 10, y + 24, { width: w - 20 });
  });
  doc.y = y + h + 6;
  doc.x = doc.page.margins.left;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: ComparisonRow[],
) {
  if (rows.length === 0) return;
  ensureSpace(doc, 40 + rows.length * 16);
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(11).text(title);
  doc.moveDown(0.2);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const totalW = right - left;
  const cols = [
    { x: left, w: totalW * 0.36, align: "left" as const, label: "Item" },
    { x: left + totalW * 0.36, w: totalW * 0.18, align: "right" as const, label: "Atual" },
    { x: left + totalW * 0.54, w: totalW * 0.18, align: "right" as const, label: "Baseline*" },
    { x: left + totalW * 0.72, w: totalW * 0.16, align: "right" as const, label: "Δ" },
    { x: left + totalW * 0.88, w: totalW * 0.12, align: "right" as const, label: "Δ %" },
  ];
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#6b7280");
  const headerY = doc.y;
  cols.forEach((c) =>
    doc.text(c.label, c.x, headerY, { width: c.w, align: c.align }),
  );
  doc.y = headerY + 12;
  doc.strokeColor("#e5e7eb").lineWidth(0.4).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.2);

  doc.font("Helvetica").fontSize(9);
  for (const row of rows) {
    ensureSpace(doc, 14);
    const y = doc.y;
    doc.fillColor("#111").text(row.label, cols[0]!.x, y, { width: cols[0]!.w, align: cols[0]!.align });
    doc.text(fmtUSD(row.current), cols[1]!.x, y, { width: cols[1]!.w, align: cols[1]!.align });
    doc.text(fmtUSD(row.baseline), cols[2]!.x, y, { width: cols[2]!.w, align: cols[2]!.align });
    const deltaColor = row.delta > 0 ? "#b91c1c" : "#15803d";
    doc.fillColor(deltaColor)
      .text(`${row.delta >= 0 ? "+" : ""}${fmtUSD(row.delta)}`, cols[3]!.x, y, { width: cols[3]!.w, align: cols[3]!.align });
    doc.text(fmtPct(row.deltaPct), cols[4]!.x, y, { width: cols[4]!.w, align: cols[4]!.align });
    doc.fillColor("#111");
    doc.y = y + 13;
  }
  doc.moveDown(0.2);
  doc.fillColor("#9ca3af").font("Helvetica-Oblique").fontSize(7).text(
    "*Baseline projetado para o mesmo número de meses do período.",
  );
  doc.moveDown(0.6);
}

function drawTimeSeriesChart(doc: PDFKit.PDFDocument, points: TimeSeriesPoint[]) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.y;
  const totalW = right - left;
  const h = 140;
  const chartLeft = left + 50;
  const chartRight = right - 8;
  const chartTop = top + 8;
  const chartBottom = top + h - 24;

  const allValues = points.flatMap((p) => [p.actual, p.projectedNoOptimization]);
  const max = Math.max(1, ...allValues);
  const min = 0;
  const xFor = (i: number) =>
    chartLeft + ((chartRight - chartLeft) * i) / Math.max(1, points.length - 1);
  const yFor = (v: number) =>
    chartBottom - ((v - min) / (max - min)) * (chartBottom - chartTop);

  // Frame
  doc
    .strokeColor("#e5e7eb")
    .lineWidth(0.5)
    .moveTo(chartLeft, chartTop)
    .lineTo(chartLeft, chartBottom)
    .lineTo(chartRight, chartBottom)
    .stroke();

  // Y ticks
  doc.fillColor("#9ca3af").font("Helvetica").fontSize(7);
  for (let t = 0; t <= 4; t++) {
    const v = min + ((max - min) * t) / 4;
    const y = yFor(v);
    doc.text(fmtUSD(v), left, y - 4, { width: 46, align: "right" });
    doc
      .strokeColor("#f3f4f6")
      .moveTo(chartLeft, y)
      .lineTo(chartRight, y)
      .stroke();
  }

  // Projected line (dashed gray)
  doc.strokeColor("#9ca3af").lineWidth(1).dash(3, { space: 3 });
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.projectedNoOptimization);
    if (i === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  });
  doc.stroke().undash();

  // Actual line (accent)
  doc.strokeColor("#5b21b6").lineWidth(1.6);
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.actual);
    if (i === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  });
  doc.stroke();

  // Dots and X labels
  doc.fillColor("#5b21b6");
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.actual);
    doc.circle(x, y, 2).fill();
  });
  doc.fillColor("#6b7280").font("Helvetica").fontSize(7);
  points.forEach((p, i) => {
    const x = xFor(i);
    doc.text(p.month, x - 18, chartBottom + 4, { width: 36, align: "center" });
  });

  // Legend
  const legendY = top + h - 8;
  doc
    .strokeColor("#5b21b6")
    .lineWidth(1.6)
    .moveTo(chartLeft, legendY)
    .lineTo(chartLeft + 14, legendY)
    .stroke();
  doc.fillColor("#111").font("Helvetica").fontSize(8).text("Custo real", chartLeft + 18, legendY - 4);
  doc
    .strokeColor("#9ca3af")
    .lineWidth(1)
    .dash(3, { space: 3 })
    .moveTo(chartLeft + 100, legendY)
    .lineTo(chartLeft + 114, legendY)
    .stroke()
    .undash();
  doc.fillColor("#111").text("Projeção sem otimização (baseline)", chartLeft + 118, legendY - 4);

  doc.fillColor("#111");
  doc.y = top + h + 4;
  doc.x = left;
}

function drawEfficiencyTable(doc: PDFKit.PDFDocument, metrics: EfficiencyMetric[]) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const totalW = right - left;
  const cols = [
    { x: left, w: totalW * 0.34, align: "left" as const, label: "Métrica" },
    { x: left + totalW * 0.34, w: totalW * 0.18, align: "right" as const, label: "Período" },
    { x: left + totalW * 0.52, w: totalW * 0.18, align: "right" as const, label: "Baseline" },
    { x: left + totalW * 0.7, w: totalW * 0.14, align: "right" as const, label: "Δ" },
    { x: left + totalW * 0.84, w: totalW * 0.16, align: "left" as const, label: "Notas" },
  ];
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#6b7280");
  const headerY = doc.y;
  cols.forEach((c) => doc.text(c.label, c.x, headerY, { width: c.w, align: c.align }));
  doc.y = headerY + 12;
  doc.strokeColor("#e5e7eb").lineWidth(0.4).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9);
  for (const m of metrics) {
    ensureSpace(doc, 18);
    const y = doc.y;
    const fmt = (v: number | null) =>
      v == null ? "—" : m.unit === "ratio" ? `${(v * 100).toFixed(1)}%` : fmtUSD(v);
    doc.fillColor("#111").text(m.label, cols[0]!.x, y, { width: cols[0]!.w });
    doc.text(fmt(m.value), cols[1]!.x, y, { width: cols[1]!.w, align: "right" });
    doc.fillColor("#6b7280").text(fmt(m.baselineValue), cols[2]!.x, y, { width: cols[2]!.w, align: "right" });
    const dColor = (m.delta ?? 0) > 0 ? "#b91c1c" : "#15803d";
    doc.fillColor(dColor).text(fmt(m.delta), cols[3]!.x, y, { width: cols[3]!.w, align: "right" });
    doc.fillColor("#6b7280").fontSize(7).text(m.hint, cols[4]!.x, y, { width: cols[4]!.w });
    doc.fontSize(9);
    doc.y = y + 16;
  }
  doc.fillColor("#111");
}

function drawOppsTable(
  doc: PDFKit.PDFDocument,
  rows: ComputedReport["sections"]["openOpportunities"],
) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const totalW = right - left;
  const cols = [
    { x: left, w: totalW * 0.42, align: "left" as const, label: "Oportunidade" },
    { x: left + totalW * 0.42, w: totalW * 0.18, align: "left" as const, label: "Categoria" },
    { x: left + totalW * 0.6, w: totalW * 0.2, align: "left" as const, label: "Provedor / Serviço" },
    { x: left + totalW * 0.8, w: totalW * 0.2, align: "right" as const, label: "Economia / mês" },
  ];
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#6b7280");
  const headerY = doc.y;
  cols.forEach((c) =>
    doc.text(c.label, c.x, headerY, { width: c.w, align: c.align }),
  );
  doc.y = headerY + 12;
  doc.strokeColor("#e5e7eb").lineWidth(0.4).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.2);

  doc.font("Helvetica").fontSize(9);
  for (const r of rows) {
    ensureSpace(doc, 16);
    const y = doc.y;
    doc.fillColor("#111").text(r.title, cols[0]!.x, y, { width: cols[0]!.w });
    doc.text(r.category, cols[1]!.x, y, { width: cols[1]!.w });
    doc.text(`${r.provider} · ${r.service}`, cols[2]!.x, y, { width: cols[2]!.w });
    doc.fillColor("#15803d").text(fmtUSD(r.monthlySavings), cols[3]!.x, y, { width: cols[3]!.w, align: "right" });
    doc.fillColor("#111");
    doc.y = y + 14;
  }
}
