import Link from "next/link";
export default function Agents() {
  return (
    <section className="card">
      <h1>Agents</h1>
      <p>View registered Agent PDAs from Devnet RPC.</p>
      <Link href="/agents/register">Register an agent</Link>
    </section>
  );
}
