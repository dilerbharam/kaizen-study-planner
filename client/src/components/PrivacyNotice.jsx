function PrivacyNotice() {
  return (
    <section
      className="privacy-notice"
      id="privacy-notice"
      aria-label="Privacy, cookies and KaizenAI information"
    >
      <details>
        <summary>
          Privacy, Cookies &amp; KaizenAI
        </summary>

        <div className="privacy-notice-content">
          <div>
            <h2>Privacy, Cookies &amp; KaizenAI</h2>
            <p>
              KaizenAI is an academic prototype for adaptive
              learning-plan creation and micro-task scheduling.
              This notice explains the main data, browser storage,
              AI and security choices used by the prototype.
            </p>
          </div>

          <div className="privacy-notice-grid">
            <section>
              <h3>Data used by the planner</h3>
              <p>
                The application stores account details, learning
                goals, milestones, topics, weekly availability,
                generated tasks, task status and learning feedback
                such as actual study time and difficulty ratings.
              </p>
            </section>

            <section>
              <h3>Cookies &amp; browser storage</h3>
              <p>
                A first-party HTTP-only authentication cookie named
                <code> kaizen_auth </code>
                is used to maintain an authenticated session.
                The browser also stores the selected goal and limited interface state to improve continuity across refreshes. These values do not contain passwords or API keys.
              </p>
              <p>
                The prototype does not use advertising or behavioural
                tracking cookies.
              </p>
            </section>

            <section>
              <h3>KaizenAI &amp; Google Gemini</h3>
              <p>
                KaizenAI uses Google Gemini 3.8 Flash as the
                underlying generative model for optional learning-plan
                drafts. When the learner chooses AI-assisted planning,
                the learning description, current level, preferences,
                target date and availability are sent for draft
                generation.
              </p>
              <p>
                The generated structure is an editable suggestion.
                It cannot create the learning plan until the learner
                reviews and approves it. Deterministic server-side
                checks remain responsible for capacity and feasibility.
              </p>
            </section>

            <section>
              <h3>Security &amp; human control</h3>
              <p>
                Passwords are stored as password hashes rather than
                plaintext. Authenticated resources are checked against
                their owner, secrets remain server-side, cross-origin
                access is restricted, and the API applies security
                headers and rate limits to sensitive endpoints.
              </p>
              <p>
                Manual plan creation remains available, so use of the
                external AI service is optional.
              </p>
            </section>
          </div>

          <div className="privacy-prototype-note">
            <h3>Prototype limitation</h3>
            <p>
              This prototype does not yet provide an automated
              retention, account-deletion or data-export workflow.
              Stored account and planner records remain in the project
              database until they are manually removed. A production
              deployment would require a formal retention policy and
              user-facing processes for applicable data rights.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}

export default PrivacyNotice;
