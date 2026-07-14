import "./style.css";
import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <header>
          <b>OpenClaw Solana DeAgent</b>
          <nav>
            <Link href="/">Home</Link>
            <Link href="/agents">Agents</Link>
            <Link href="/jobs">Jobs</Link>
            <Link href="/transactions/sign">Sign</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
