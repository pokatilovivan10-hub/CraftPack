/**
 * Дата прайса из самого файла ("2026-09-04 22:22:27") — это публичная
 * «дата обновления источника». Время загрузки файла в систему хранится
 * отдельно (createdAt у партии импорта) и никогда не подменяет дату прайса.
 */
export function parseSourceDate(priceDate: string | null): Date | null {
  if (!priceDate) return null;
  const m = priceDate.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const d = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6] ?? 0),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}
