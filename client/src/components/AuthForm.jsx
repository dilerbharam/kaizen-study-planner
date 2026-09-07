import { useState } from "react";
import api from "../services/api";

function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const isRegistering = mode === "register";

  const switchMode = () => {
    setMode((current) =>
      current === "login"
        ? "register"
        : "login"
    );
    setMessage("");
    setPassword("");
  };

  const submitForm = async (event) => {
    event.preventDefault();

    setMessage("");

    if (
      isRegistering &&
      !name.trim()
    ) {
      setMessage("Name is required.");
      return;
    }

    if (!email.trim() || !password) {
      setMessage(
        "Email and password are required."
      );
      return;
    }

    if (
      isRegistering &&
      password.length < 10
    ) {
      setMessage(
        "Password must contain at least 10 characters."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isRegistering
        ? "/api/auth/register"
        : "/api/auth/login";

      const payload = isRegistering
        ? {
            name: name.trim(),
            email: email.trim(),
            password,
          }
        : {
            email: email.trim(),
            password,
          };

      const response = await api.post(
        endpoint,
        payload
      );

      await onAuthenticated(
        response.data.user
      );
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          "Authentication could not be completed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-container">
      <header className="main-header">
        <div>
          <h1>Kaizen Study Planner</h1>
          <p className="subtitle">
            Adaptive micro-task planner for
            structured learning
          </p>
        </div>
      </header>

      <section className="card setup-card">
        <div className="section-header">
          <div>
            <h2>
              {isRegistering
                ? "Create Account"
                : "Sign In"}
            </h2>

            <p>
              {isRegistering
                ? "Create a private planner account to manage your learning goals."
                : "Sign in to access your learning plans."}
            </p>
          </div>
        </div>

        {message && (
          <p
            className="message error"
            role="alert"
          >
            {message}
          </p>
        )}

        <form onSubmit={submitForm}>
          <div className="form-grid">
            {isRegistering && (
              <label>
                Name

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  autoComplete="name"
                  maxLength="100"
                  disabled={isSubmitting}
                />
              </label>
            )}

            <label>
              Email

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
                maxLength="150"
                disabled={isSubmitting}
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete={
                  isRegistering
                    ? "new-password"
                    : "current-password"
                }
                minLength={
                  isRegistering
                    ? 10
                    : undefined
                }
                disabled={isSubmitting}
              />
            </label>
          </div>

          <div className="task-actions">
            <button
              type="submit"
              className="primary-action"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isRegistering
                  ? "Creating Account..."
                  : "Signing In..."
                : isRegistering
                  ? "Create Account"
                  : "Sign In"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={switchMode}
              disabled={isSubmitting}
            >
              {isRegistering
                ? "Already have an account? Sign In"
                : "Need an account? Register"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AuthForm;
