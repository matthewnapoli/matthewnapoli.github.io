const texts = [
  "Hello World,",
  "My name is Matthew Napoli, and I am a current December 2023 graduate from UCLA.",
  "Here is some of my work:",
  { text: "LinkedIn", link: "https://www.linkedin.com/in/matthew--napoli/" },
  { text: "Github", link: "https://github.com/matthewnapoli" },
  { text: "Research Paper (in-progress)", link: "https://github.com/matthewnapoli/Research-Paper/blob/main/Volatility_Paper.pdf" },
  { text: "Trading Algorithms (via Quantconnect)", link: "https://github.com/matthewnapoli/quantconnect-algos/tree/main" },
  { text: "Basic Trading Simulator", link: "https://github.com/matthewnapoli/PIC16B-Proj" },
  { text: "Leetcode", link: "https://leetcode.com/matthewzz/" },
  "(This took  ~π^2 seconds to complete)"
];

const typingText = document.getElementById("typing-text");
const typingCursor = document.getElementById("typing-cursor");

let lineIndex = 0;
let charIndex = 0;
let fullText = "";

function typeText() {
  if (lineIndex < texts.length) {
    const currentLine = texts[lineIndex];
    if (typeof currentLine === "string") {
      // Regular text line
      if (charIndex < currentLine.length) {
        fullText += currentLine[charIndex];
        typingText.innerHTML = fullText;
        charIndex++;
        setTimeout(typeText, 36.02045401); // Delay between typing each character
      } else {
        lineIndex++;
        charIndex = 0;
        fullText += "<br><br>";
        typingText.innerHTML = fullText;
        setTimeout(typeText, 36.02045401); // Delay before typing the next line
      }
    } else {
      // Hyperlink
      if (charIndex < currentLine.text.length) {
        const linkText = currentLine.text.slice(charIndex, charIndex + 1);
        fullText += `<a href="${currentLine.link}" target="_blank">${linkText}</a>`;
        typingText.innerHTML = fullText;
        charIndex++;
        setTimeout(typeText, 36.02045401); // Delay between typing each character
      } else {
        lineIndex++;
        charIndex = 0;
        fullText += `<br>`;
        typingText.innerHTML = fullText;
        if(lineIndex == 9)
        {
          fullText += `<br>`;
          typingText.innerHTML = fullText;
        }
        setTimeout(typeText, 36.02045401); // Delay before typing the next lines
      }
    }
  }
}

typeText();
