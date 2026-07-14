import Link from "next/link";
export default function Jobs() {
  return (
    <section className="card">
      <h1>Jobs</h1>
      <p>
        Track job status, result hashes, evaluation hashes, and Explorer links.
      </p>
      <Link href="/jobs/create">Create a job</Link>
    </section>
  );
}
