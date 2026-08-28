export interface IHelloProps {
  description: string;
}

function escapeHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function Hello(props: IHelloProps): string {
  return `<div class="hello">${escapeHtml(props.description)}</div>`;
}
