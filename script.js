const texts = [
  "Hello World!",
  "My name is Matthew Napoli.",
  "I am currently a December 2023 grad from UCLA majoring in Mathematics & Economics, and, minoring in Computing.<img src='img/bruin-logo.png' alt='UCLA Bruins Logo' style='width: 24px; height: 24px; margin-bottom: -4px'>",
  "Here is some of my work:",
  { text: "LinkedIn", link: "https://www.linkedin.com/in/matthew--napoli/" },
  { text: "Github", link: "https://github.com/matthewnapoli" },
  { text: "Research Paper (in-progress)", link: "https://github.com/matthewnapoli/Research-Paper/blob/main/Volatility_Paper.pdf" },
  { text: "Trading Algorithms (via Quantconnect)", link: "https://github.com/matthewnapoli/quantconnect-algos/tree/main" },
  { text: "Basic Trading Simulator", link: "https://github.com/matthewnapoli/PIC16B-Proj" },
  { text: "Leetcode", link: "https://leetcode.com/matthewzz/" },
  '<p style="font-size: 15px">(This took π<sup>π</sup> seconds to render)</p>'
];

const waitingTime = 104.17759887;
const typingText = document.getElementById("typing-text");
const typingCursor = document.getElementById("typing-cursor");
typingText.appendChild(typingCursor);

let lineIndex = 0;
let charIndex = 0;
let fullText = "";


function typeText() {
  if (lineIndex < texts.length) {
    const currentLine = texts[lineIndex];
    if (typeof currentLine === "string") 
    {
      // Regular text line
      if (charIndex < currentLine.length) {
        fullText += currentLine[charIndex];
        typingText.innerHTML = fullText;
        typingText.append(typingCursor)
        charIndex++;
        if(lineIndex == 2 && charIndex >= 116)
        {
          typeText(); // Load the image faster
        }
        else
        {
          setTimeout(typeText, waitingTime); // Delay between typing each character
        }
        typingCursor.style.left+="24px";
      } else {
        lineIndex++;
        charIndex = 0;
        if(lineIndex < 9)
        {
          fullText += "<br><br>";
        }  
        typingText.innerHTML = fullText;
        typingText.append(typingCursor)

        setTimeout(typeText, waitingTime); // Delay before typing the next line
      }
    } else {
      // Hyperlink
      if (charIndex < currentLine.text.length) {
        const linkText = currentLine.text.slice(charIndex, charIndex + 1);
        fullText += `<a href="${currentLine.link}" target="_blank">${linkText}</a>`;
        typingText.innerHTML = fullText;
        

        charIndex++;
        setTimeout(typeText, waitingTime); // Delay between typing each character
      } else {
        lineIndex++;
        charIndex = 0;
        fullText += `<br>`;
        typingText.innerHTML = fullText;
        typingText.append(typingCursor)
        if (lineIndex === 10) {
          fullText += `<br>`;
          typingText.innerHTML = fullText;
          typingText.append(typingCursor)
        }
        setTimeout(typeText, waitingTime); // Delay before typing the next lines
      }
    }
  }
}



typeText();
