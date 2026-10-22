/**
 * Utilitário estrito para formatação de datas em padrão brasileiro: "dd/mm/aaaa"
 */
export function formatDateBR(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
