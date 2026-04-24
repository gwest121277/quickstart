export const metadata = {
  title: "Quickstart.life Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ color: "#00B4A6", marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#888", marginTop: 0 }}>
        Quickstart.life Chrome extension. Last updated April 24, 2026.
      </p>

      <h2>What this extension does</h2>
      <p>
        Quickstart.life helps you capture what you were working on at the end of
        a session so you can pick back up fast. When you choose "Shut down", it
        records up to 30 seconds of your voice (or lets you type instead),
        captures the URLs and titles of your open tabs, and uses AI to turn
        that into a short re-entry card you can read when you come back.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Identity</strong>: your email address and display name, from
          Google when you sign in with Google.
        </li>
        <li>
          <strong>Projects you create</strong>: the name and goal you type in.
        </li>
        <li>
          <strong>Session capsules</strong>: the audio you record (transcribed
          and then discarded), the resulting transcript text, the URLs and
          titles of the tabs you had open at shutdown, and the AI-generated
          summary card.
        </li>
      </ul>
      <p>
        We do not collect browsing history, cookies, page contents, form data,
        passwords, or anything outside the shutdown action you initiate.
      </p>

      <h2>Where your data goes</h2>
      <ul>
        <li>
          <strong>Supabase</strong> (our database and authentication provider)
          stores your projects, transcripts, and capsules.
        </li>
        <li>
          <strong>OpenAI</strong> receives your shutdown audio for
          transcription (Whisper). The audio is sent over HTTPS, transcribed,
          and not retained by us after transcription.
        </li>
        <li>
          <strong>Anthropic</strong> receives your transcript and tab list to
          generate the re-entry summary (Claude).
        </li>
      </ul>
      <p>
        We do not sell your data, run ads, or share it with third parties
        beyond the processors listed above.
      </p>

      <h2>Your data, your control</h2>
      <ul>
        <li>
          Delete any project from the extension popup and all its capsules go
          with it.
        </li>
        <li>
          Sign out from the extension popup at any time.
        </li>
        <li>
          To delete your account and all associated data, email{" "}
          <a href="mailto:gwest1212@gmail.com" style={{ color: "#00B4A6" }}>
            gwest1212@gmail.com
          </a>{" "}
          and we will remove it within 7 days.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is transmitted over HTTPS. Access to your data is scoped to you:
        our backend verifies your sign-in on every request, and database
        policies ensure you can only read or write your own rows.
      </p>

      <h2>Children</h2>
      <p>Quickstart.life is not directed at anyone under 13.</p>

      <h2>Changes</h2>
      <p>
        If this policy changes, we will update the date at the top and post the
        updated version at this URL.
      </p>

      <h2>Contact</h2>
      <p>
        Questions:{" "}
        <a href="mailto:gwest1212@gmail.com" style={{ color: "#00B4A6" }}>
          gwest1212@gmail.com
        </a>
      </p>
    </main>
  );
}
