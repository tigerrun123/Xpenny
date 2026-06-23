const task = document.querySelector("#task");
const output = document.querySelector("#output");
const button = document.querySelector("#hash");

button.addEventListener("click", async () => {
  let payload;
  try {
    payload = JSON.parse(task.value);
  } catch {
    output.textContent = "Invalid JSON payload.";
    return;
  }

  const response = await fetch("/api/hash", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  output.textContent = JSON.stringify(await response.json(), null, 2);
});
