import { execFileSync } from "node:child_process";

const base = process.env.PREVIEW_BASE_URL ?? "https://innovation-platform-git-ux-demo-improvements-ateam16.vercel.app";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const session = `preview-e2e-${Date.now()}`;

function browser(...args) {
  return execFileSync(npx, ["agent-browser", "--session", session, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function activePersona() {
  return browser("eval", "document.querySelector('[data-testid=active-preview-persona]')?.dataset.previewPersona ?? 'missing'").replaceAll('"', "");
}

function assertPersona(expected, step) {
  const actual = activePersona();
  if (actual !== expected) throw new Error(`${step}: expected ${expected}, received ${actual}`);
  const errors = browser("errors");
  if (/React|hydration|404|500|Unhandled/i.test(errors)) throw new Error(`${step}: browser errors: ${errors}`);
}

function openAs(role) {
  browser("open", `${base}/dashboard?previewRole=${role}`);
  browser("wait", "--load", "networkidle");
  assertPersona(role, `${role}: dashboard`);
}

function clickLink(role, label) {
  browser("find", "role", "link", "click", "--name", label);
  browser("wait", "--load", "networkidle");
  assertPersona(role, `${role}: ${label}`);
}

const journeys = {
  admin: ["الاستراتيجية والخطة السنوية", "البرامج والفعاليات", "التحديات", "بنك الابتكار", "الحلول الابتكارية", "اللجان والتقييمات", "الجاهزية والامتثال", "قياس الأثر", "الأدلة والوثائق", "الجهات والشركاء", "الاتفاقيات والتعاون", "المهام والتنبيهات", "التقارير", "المستخدمون والصلاحيات", "طلبات التسجيل", "سجل التدقيق", "الإعدادات", "لوحة العمل"],
  internal: ["الاستراتيجية والخطة السنوية", "البرامج والفعاليات", "التحديات", "بنك الابتكار", "الحلول الابتكارية", "اللجان والتقييمات", "قياس الأثر", "الأدلة والوثائق", "الجاهزية والامتثال", "الجهات والشركاء", "الاتفاقيات والتعاون", "المهام والتنبيهات", "التقارير", "لوحة العمل"],
  partner: ["الجهات والشركاء", "الاتفاقيات والتعاون", "الحلول الابتكارية", "الأدلة والوثائق", "المهام والتنبيهات", "لوحة العمل"],
  viewer: ["الاستراتيجية والخطة السنوية", "البرامج والفعاليات", "الحلول الابتكارية", "قياس الأثر", "الجاهزية والامتثال", "التقارير", "لوحة العمل"],
};

try {
  for (const [role, links] of Object.entries(journeys)) {
    openAs(role);
    for (const label of links) clickLink(role, label);
    browser("open", browser("get", "url"));
    browser("wait", "--load", "networkidle");
    assertPersona(role, `${role}: refresh`);
    console.log(`${role}: ${links.length}/${links.length} links + refresh passed`);
  }

  openAs("viewer");
  clickLink("viewer", "الحلول الابتكارية");
  clickLink("viewer", "المساعد الرقمي لخدمات المستفيدين");
  clickLink("viewer", "العودة إلى الحلول");
  browser("select", "[data-testid=active-preview-persona]", "admin");
  browser("wait", "--load", "networkidle");
  assertPersona("admin", "explicit viewer to admin switch");
  console.log("detail/back + explicit switch passed");
} finally {
  try { browser("close"); } catch {}
}
