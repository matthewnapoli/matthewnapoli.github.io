function setupTypewriter(element) {
    // Get the original HTML content
    var originalHTML = element.innerHTML;
    // Clear the element to start typing
    element.innerHTML = "";

    // Create text and cursor elements
    var textSpan = document.createElement('span');
    textSpan.className = 'typewriter-text';
    var cursorSpan = document.createElement('span');
    cursorSpan.className = 'typewriter-cursor';
    element.appendChild(
        (function(){
            var mark = document.createElement('mark');
            mark.style.background = '#000000';
            mark.style.color = '#ffffff';
            mark.appendChild(textSpan);
            mark.appendChild(cursorSpan);
            return mark;
        })()
    );

    // CSS for blinking rectangle cursor
    var cursorStyle = `<style>
    .typewriter-cursor {
        display: inline-block;
        width: 0.7em;
        height: 1em;
        background: #ffffff;
        vertical-align: bottom;
        margin-left: 2px;
        animation: blink-rect 1s steps(1) infinite;
    }
    @keyframes blink-rect {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
    }
    </style>`;
    if (!document.querySelector('.typewriter-cursor-style')) {
        var styleElement = document.createElement('div');
        styleElement.innerHTML = cursorStyle;
        styleElement.className = 'typewriter-cursor-style';
        document.head.appendChild(styleElement.firstElementChild);
    }

    var cursorPosition = 0;
    var displayText = "";

    var type = function() {
        while (cursorPosition < originalHTML.length) {
            var currentChar = originalHTML[cursorPosition];
            // Instantly add HTML tags (like <mark ...>)
            if (currentChar === '<') {
                var tag = '';
                while (cursorPosition < originalHTML.length && originalHTML[cursorPosition] !== '>') {
                    tag += originalHTML[cursorPosition];
                    cursorPosition++;
                }
                if (cursorPosition < originalHTML.length) {
                    tag += '>';
                    cursorPosition++;
                }
                displayText += tag;
                continue; // Instantly add tag, do not delay
            }
            // Regular character - add to display with delay
            displayText += currentChar;
            cursorPosition++;
            // Update only the text span
            textSpan.innerHTML = displayText;
            // Variable typing speed for more realistic effect
            var delay = 40; // Base speed
            if (currentChar === '.' || currentChar === '!' || currentChar === '?') {
                delay = 60; // Pause at end of sentences
            } else if (currentChar === ',' || currentChar === ':' || currentChar === ';') {
                delay = 45; // Short pause at punctuation
            } else if (currentChar === ' ') {
                delay = 20; // Faster for spaces
            }
            setTimeout(type, delay);
            return;
        }
    // Typing complete - keep cursor blinking at the end
    textSpan.innerHTML = displayText;
    cursorSpan.style.display = '';
    };

    return {
        type: type
    };
}

// Initialize the typewriter effect as soon as the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    var typewriterElement = document.getElementById('typewriter');
    if (typewriterElement) {
        var typewriter = setupTypewriter(typewriterElement);
        typewriter.type();
    }
});