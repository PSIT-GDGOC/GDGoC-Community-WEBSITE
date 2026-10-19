import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Auth from "../src/components/Auth";

const json = (status: number, body: object) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
let login: () => Promise<Response>;

beforeEach(() => {
  location.hash = "#/login";
  login = () => json(401, { message: "Wrong email or password." });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/users/me")) {
        return json(401, {});
      }
      return login();
    }),
  );
});
afterEach(cleanup);

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(document.querySelector('button[type="submit"]')!);

test("empty login shows field errors and focuses the first one", async () => {
  render(<Auth />);
  submit();
  expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
  expect(screen.getByText("Enter your password.")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByLabelText(/^email/i));
  expect(screen.getByLabelText(/^email/i).getAttribute("aria-invalid")).toBe("true");
});

test("password visibility toggle", () => {
  render(<Auth />);
  const pw = screen.getByLabelText(/^password/i);
  expect(pw.getAttribute("type")).toBe("password");
  fireEvent.click(screen.getByLabelText(/show password/i));
  expect(pw.getAttribute("type")).toBe("text");
});

test("switching to sign up keeps the email, clears the password and focuses name", () => {
  render(<Auth />);
  type(/^email/i, "a@psit.ac.in");
  type(/^password/i, "secret123");
  fireEvent.click(screen.getByRole("button", { name: /create an account/i }));
  expect(screen.getByRole("heading", { name: /create your account/i })).toBeTruthy();
  expect((screen.getByLabelText(/college email/i) as HTMLInputElement).value).toBe("a@psit.ac.in");
  expect((screen.getByLabelText(/^password/i) as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(screen.getByLabelText(/full name/i));
});

test("sign-up validation catches mismatched passwords", async () => {
  location.hash = "#/login?mode=signup";
  render(<Auth />);
  type(/full name/i, "Asha Verma");
  type(/college email/i, "a@psit.ac.in");
  type(/^password/i, "secret123");
  type(/confirm password/i, "secret124");
  submit();
  expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
});

test("wrong credentials show the server message and keep the email", async () => {
  render(<Auth />);
  type(/^email/i, "a@psit.ac.in");
  type(/^password/i, "wrong1234");
  submit();
  expect(await screen.findByText("Wrong email or password.")).toBeTruthy();
  expect((screen.getByLabelText(/^email/i) as HTMLInputElement).value).toBe("a@psit.ac.in");
});

test("network failure shows a retryable message", async () => {
  login = () => Promise.reject(new TypeError("Failed to fetch"));
  render(<Auth />);
  type(/^email/i, "a@psit.ac.in");
  type(/^password/i, "secret123");
  submit();
  expect(await screen.findByText(/can't reach the server/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Log in" }).hasAttribute("disabled")).toBe(false);
});

test("loading state blocks resubmits, then success goes to the next page", async () => {
  location.hash = "#/login?next=/events";
  let finish!: () => void;
  login = () => new Promise((ok) => (finish = () => ok(new Response("{}", { status: 200 }))));
  render(<Auth />);
  type(/^email/i, "a@psit.ac.in");
  type(/^password/i, "secret123");
  submit();
  const busy = await screen.findByRole("button", { name: /logging in/i });
  expect(busy.hasAttribute("disabled")).toBe(true);
  fireEvent.click(busy);
  expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith("/auth/login"))).toHaveLength(1);
  await act(async () => finish());
  await waitFor(() => expect(location.hash).toBe("#/events"));
});

test("already logged in skips the form; unsafe next falls back to the dashboard", async () => {
  location.hash = "#/login?next=//evil.com";
  vi.stubGlobal(
    "fetch",
    vi.fn(() => json(200, { name: "Asha", email: "a@psit.ac.in" })),
  );
  render(<Auth />);
  await waitFor(() => expect(location.hash).toBe("#/dashboard"));
});

test("sign up is prefilled from the join form link", () => {
  location.hash = "#/login?mode=signup&name=Asha%20Verma&email=a%40psit.ac.in&year=2";
  render(<Auth />);

  expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("Asha Verma");
  expect((screen.getByLabelText(/college email/i) as HTMLInputElement).value).toBe("a@psit.ac.in");
  expect((screen.getByLabelText(/year/i) as HTMLSelectElement).value).toBe("2");
});
