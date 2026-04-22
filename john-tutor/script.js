const SITE_CONFIG = {
  tutorEmail: "john.tutor@example.com",
  tutorName: "JOHN TUTOR",
  formEndpoint: "",
  googleAppointmentScheduleUrl: "",
};

const emailTargets = [
  document.querySelector("#calendar-email"),
  document.querySelector("#interest-email"),
  document.querySelector("#footer-email"),
].filter(Boolean);

for (const target of emailTargets) {
  target.textContent = SITE_CONFIG.tutorEmail;
  if (target.tagName === "A") {
    target.href = `mailto:${SITE_CONFIG.tutorEmail}`;
  }
}

const bookingForm = document.querySelector("#booking-form");
const interestForm = document.querySelector("#interest-form");
const sessionStartInput = document.querySelector("#session-start");
const formNote = document.querySelector("#form-note");
const interestNote = document.querySelector("#interest-note");
const copyEmailButton = document.querySelector("#copy-email");

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toGoogleCalendarDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function nextFriendlyStart() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(16, 0, 0, 0);
  return start;
}

function openMailTo({ subject, body }) {
  const href = `mailto:${encodeURIComponent(SITE_CONFIG.tutorEmail)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

function buildCalendarUrl({ title, start, lengthMinutes, details }) {
  const end = new Date(start.getTime() + lengthMinutes * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`,
    details,
    add: SITE_CONFIG.tutorEmail,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

if (sessionStartInput) {
  const defaultStart = nextFriendlyStart();
  sessionStartInput.min = toLocalInputValue(new Date());
  sessionStartInput.value = toLocalInputValue(defaultStart);
}

if (bookingForm) {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const sessionType = document.querySelector("#session-type").value;
    const sessionStart = new Date(document.querySelector("#session-start").value);
    const sessionLength = Number(document.querySelector("#session-length").value);
    const goals = document.querySelector("#session-goals").value.trim();

    if (Number.isNaN(sessionStart.getTime())) {
      formNote.textContent = "Choose a date and time first.";
      return;
    }

    if (SITE_CONFIG.googleAppointmentScheduleUrl) {
      window.open(SITE_CONFIG.googleAppointmentScheduleUrl, "_blank", "noopener");
      formNote.textContent = "Opening John's Google Calendar booking page.";
      return;
    }

    const details = [
      `Session type: ${sessionType}`,
      `Length: ${sessionLength} minutes`,
      goals ? `Student goals: ${goals}` : "Student goals: To be discussed",
    ].join("\n");

    const calendarUrl = buildCalendarUrl({
      title: `${SITE_CONFIG.tutorName} - ${sessionType}`,
      start: sessionStart,
      lengthMinutes: sessionLength,
      details,
    });

    window.open(calendarUrl, "_blank", "noopener");
    formNote.textContent = `Opening Google Calendar for ${SITE_CONFIG.tutorEmail}.`;
  });
}

if (copyEmailButton) {
  copyEmailButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(SITE_CONFIG.tutorEmail);
      formNote.textContent = "Tutor email copied.";
    } catch {
      formNote.textContent = SITE_CONFIG.tutorEmail;
    }
  });
}

if (interestForm) {
  interestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = {
      name: document.querySelector("#family-name").value.trim(),
      email: document.querySelector("#family-email").value.trim(),
      grade: document.querySelector("#student-grade").value.trim() || "Not specified",
      subject: document.querySelector("#interest-subject").value,
      bestTimes: document.querySelector("#best-times").value.trim() || "Not specified",
      message: document.querySelector("#interest-message").value.trim(),
    };

    const body = [
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Student grade: ${data.grade}`,
      `Main subject: ${data.subject}`,
      `Best times: ${data.bestTimes}`,
      "",
      data.message,
    ].join("\n");

    if (SITE_CONFIG.formEndpoint) {
      interestNote.textContent = "Sending...";
      try {
        const response = await fetch(SITE_CONFIG.formEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error("Form endpoint failed");
        }

        interestForm.reset();
        interestNote.textContent = "Thanks, your interest form was sent.";
        return;
      } catch {
        interestNote.textContent = "Opening your email app instead.";
      }
    }

    openMailTo({
      subject: `${SITE_CONFIG.tutorName} tutoring interest`,
      body,
    });
    interestNote.textContent = `Opening an email addressed to ${SITE_CONFIG.tutorEmail}.`;
  });
}
