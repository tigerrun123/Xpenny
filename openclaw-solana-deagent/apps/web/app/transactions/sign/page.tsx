export default function Sign() {
  return (
    <section className="card">
      <h1>Sign Unsigned Transaction</h1>
      <p>
        Paste a plugin-generated base64 transaction. The DApp should simulate it
        and display amount, mint, source, destination, and required signer
        before wallet signing.
      </p>
      <textarea placeholder="transactionBase64" />
      <button>Simulate</button>
      <button>Sign and submit</button>
    </section>
  );
}
