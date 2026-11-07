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
  expect((screen.getByLabelText(/email address/i) as HTMLInputElement).value).toBe("a@psit.ac.in");
  expect((screen.getByLabelText(/^password/i) as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(screen.getByLabelText(/full name/i));
});

test("sign-up validation catches mismatched passwords", async () => {
  location.hash = "#/login?mode=signup";
  render(<Auth />);
  type(/full name/i, "Asha Verma");
  type(/email address/i, "a@psit.ac.in");
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
  expect((screen.getByLabelText(/email address/i) as HTMLInputElement).value).toBe("a@psit.ac.in");
  expect((screen.getByLabelText(/year/i) as HTMLSelectElement).value).toBe("2");
});

test("sign up accepts personal email addresses like Gmail, Outlook, Yahoo", async () => {
  location.hash = "#/login?mode=signup";
  render(<Auth />);

  // Valid Gmail
  type(/full name/i, "Gmail User");
  type(/email address/i, "user@gmail.com");
  type(/^password/i, "password123");
  type(/confirm password/i, "password123");
  submit();

  // No email validation error should appear
  await waitFor(() => {
    expect(screen.queryByText(/valid email address/i)).toBeNull();
    expect(screen.queryByText(/campus email/i)).toBeNull();
  });
});

test("sign up rejects syntactically invalid email addresses", async () => {
  location.hash = "#/login?mode=signup";
  render(<Auth />);

  type(/full name/i, "Invalid Email User");
  type(/email address/i, "invalid-email-without-at");
  type(/^password/i, "password123");
  type(/confirm password/i, "password123");
  submit();

  expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
});

test("successful sign up creates session and navigates directly to dashboard without OTP", async () => {
  location.hash = "#/login?mode=signup";
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/users/me")) {
        return json(401, {});
      }
      if (url.endsWith("/auth/register")) {
        return json(201, { name: "Direct Member", email: "direct@gmail.com", role: "student" });
      }
      return login();
    }),
  );

  render(<Auth />);
  type(/full name/i, "Direct Member");
  type(/email address/i, "direct@gmail.com");
  type(/^password/i, "password123");
  type(/confirm password/i, "password123");
  submit();

  await waitFor(() => expect(location.hash).toBe("#/dashboard"));
  expect(screen.queryByText(/verification code/i)).toBeNull();
  expect(screen.queryByText(/resend code/i)).toBeNull();
});

test("login page displays 'Forgot password?' button that switches to recovery form", () => {
  location.hash = "#/login";
  render(<Auth />);

  const forgotBtn = screen.getByRole("button", { name: /forgot password\?/i });
  expect(forgotBtn).toBeTruthy();

  fireEvent.click(forgotBtn);

  expect(screen.getByRole("heading", { name: /reset your password/i })).toBeTruthy();
  expect(screen.getByRole("button", { name: /request reset link/i })).toBeTruthy();
  expect(screen.getByRole("button", { name: /back to login/i })).toBeTruthy();
});

test("requesting a reset link calls POST /auth/forgot-password and shows confirmation message", async () => {
  location.hash = "#/login?mode=forgot";
  let forgotCalled = false;

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).endsWith("/users/me")) {
        return json(401, {});
      }
      if (String(url).endsWith("/auth/forgot-password") && init?.method === "POST") {
        forgotCalled = true;
        return json(200, {
          message: "If an account exists with that email address, a password reset link has been sent.",
        });
      }
      return login();
    })
  );

  render(<Auth />);
  type(/email address/i, "student@psit.ac.in");
  fireEvent.click(screen.getByRole("button", { name: /request reset link/i }));

  await waitFor(() => {
    expect(forgotCalled).toBe(true);
    expect(screen.getAllByText(/check your inbox/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/student@psit.ac.in/i)).toBeTruthy();
  });
});

test("reset mode displays new password form and submits to POST /auth/reset-password", async () => {
  location.hash = "#/login?mode=reset&token=valid_token_xyz&email=student%40psit.ac.in";
  let resetCalled = false;

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).endsWith("/auth/reset-password") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.token).toBe("valid_token_xyz");
        expect(body.email).toBe("student@psit.ac.in");
        expect(body.password).toBe("NewSecret123!");
        resetCalled = true;
        return json(200, { message: "Password reset successfully. You can now log in with your new password." });
      }
      return login();
    })
  );

  render(<Auth />);

  expect(screen.getByRole("heading", { name: /set new password/i })).toBeTruthy();
  type(/^new password/i, "NewSecret123!");
  type(/confirm new password/i, "NewSecret123!");
  fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

  await waitFor(() => {
    expect(resetCalled).toBe(true);
    expect(screen.getByText(/password reset successful/i)).toBeTruthy();
  });

  const returnBtn = screen.getByRole("button", { name: /return to login/i });
  expect(returnBtn).toBeTruthy();
  fireEvent.click(returnBtn);

  expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
});
