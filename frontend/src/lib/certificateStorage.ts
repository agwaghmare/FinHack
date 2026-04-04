const KEY = "finhack_certificates_v1";

export type StoredCertificate = {
  moduleId: string;
  moduleTitle: string;
  credential: string;
  certificate_hash?: string;
  issued_at?: string;
  userName: string;
  savedAt: string;
};

export function loadCertificates(): StoredCertificate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StoredCertificate =>
        x != null &&
        typeof x === "object" &&
        typeof (x as StoredCertificate).moduleId === "string" &&
        typeof (x as StoredCertificate).credential === "string",
    );
  } catch {
    return [];
  }
}

export function saveCertificateRecord(entry: Omit<StoredCertificate, "savedAt">): void {
  const list = loadCertificates();
  const savedAt = new Date().toISOString();
  const next: StoredCertificate = { ...entry, savedAt };
  const filtered = list.filter(
    (c) => !(c.moduleId === next.moduleId && c.credential === next.credential),
  );
  filtered.unshift(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch {
    /* quota */
  }
}
