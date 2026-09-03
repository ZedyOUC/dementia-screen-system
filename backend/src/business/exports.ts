import type { Assessment, Patient } from "./types.js";

function utf16Hex(value: string): string {
  const bytes: number[] = [0xfe, 0xff];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return Buffer.from(bytes).toString("hex").toUpperCase();
}

export function createAssessmentPdf(patient: Patient, assessment: Assessment): Buffer {
  const score = assessment.scoreSummary.totalScore;
  const lines = [
    "认知筛查评估报告",
    `患者编号：${patient.patientCode}`,
    `姓名：${patient.name}`,
    `量表：${assessment.scaleCode}（${assessment.scaleVersion}）`,
    `状态：${assessment.status}`,
    `总分：${score === null ? "待任务1评分引擎计算" : `${score}/${assessment.scoreSummary.maximumScore ?? "-"}`}`,
    `结果：${assessment.scoreSummary.resultLabel ?? "暂无结论"}`,
    `提交时间：${assessment.submittedAt ?? "未提交"}`,
    "说明：本报告为筛查记录，不替代临床诊断。",
  ];
  const stream = ["BT", "/F1 14 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    if (index > 0) stream.push("0 -28 Td");
    stream.push(`<${utf16Hex(line)}> Tj`);
  });
  stream.push("ET");
  const content = Buffer.from(stream.join("\n"), "ascii");
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "ascii"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>",
      "ascii",
    ),
    Buffer.from(
      "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>",
      "ascii",
    ),
    Buffer.from(
      "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>",
      "ascii",
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "ascii"),
      content,
      Buffer.from("\nendstream", "ascii"),
    ]),
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "ascii"),
      object,
      Buffer.from("\nendobj\n", "ascii"),
    ]);
    chunks.push(chunk);
    length += chunk.length;
  });
  const xrefOffset = length;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  offsets.slice(1).forEach((offset) => xref.push(`${String(offset).padStart(10, "0")} 00000 n `));
  xref.push(
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  );
  chunks.push(Buffer.from(`${xref.join("\n")}\n`, "ascii"));
  return Buffer.concat(chunks);
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function createAssessmentsExcel(
  assessments: Assessment[],
  patients: Patient[],
): Buffer {
  const headings = [
    "测评ID", "患者编号", "患者姓名", "量表", "版本", "状态", "总分", "是否异常", "测评员ID", "提交时间",
  ];
  const rows = assessments.map((assessment) => {
    const patient = patients.find((item) => item.patientId === assessment.patientId);
    return [
      assessment.assessmentId,
      patient?.patientCode ?? "",
      patient?.name ?? "",
      assessment.scaleCode,
      assessment.scaleVersion,
      assessment.status,
      assessment.scoreSummary.totalScore ?? "",
      assessment.scoreSummary.isAbnormal === null
        ? "待判定"
        : assessment.scoreSummary.isAbnormal ? "是" : "否",
      assessment.assessorId,
      assessment.submittedAt ?? "",
    ];
  });
  const worksheetRows = [headings, ...rows]
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join("")}</Row>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="测评记录"><Table>${worksheetRows}</Table></Worksheet>
</Workbook>`;
  return Buffer.from(`\uFEFF${xml}`, "utf8");
}
