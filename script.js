function setupTypewriter(element) {
    var originalHTML = element.innerHTML;
    var cursorPosition = 0;
    var displayText = "";
    var typeTimeout = null;

    function addTypewriterStyles() {
        if (document.querySelector('.typewriter-style')) {
            return;
        }

        var styleElement = document.createElement('style');
        styleElement.className = 'typewriter-style';
        styleElement.textContent = `
        .typewriter-cursor {
            display: inline-block;
            width: 0.7em;
            height: 1em;
            background: #ffffff;
            vertical-align: bottom;
            margin-left: 2px;
            animation: blink-rect 1s steps(1) infinite;
        }

        .typewriter-replay-button {
            background: #050505;
            border: 1px solid rgba(255, 255, 255, 0.35);
            color: #ffffff;
            cursor: pointer;
            font-family: 'Source Code Pro', monospace;
            font-size: 0.78rem;
            min-height: 1.75rem;
            padding: 0.15rem 0.45rem;
        }

        .typewriter-replay-button:disabled {
            cursor: default;
            opacity: 0.65;
        }

        @keyframes blink-rect {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
        `;
        document.head.appendChild(styleElement);
    }

    function createTypingSurface() {
        element.innerHTML = "";

        var textSpan = document.createElement('span');
        textSpan.className = 'typewriter-text';

        var cursorSpan = document.createElement('span');
        cursorSpan.className = 'typewriter-cursor';

        var mark = document.createElement('mark');
        mark.style.background = '#000000';
        mark.style.color = '#ffffff';
        mark.appendChild(textSpan);
        mark.appendChild(cursorSpan);
        element.appendChild(mark);

        return textSpan;
    }

    function getDelay(currentChar) {
        if (currentChar === '.' || currentChar === '!' || currentChar === '?') {
            return 48;
        }

        if (currentChar === ',' || currentChar === ':' || currentChar === ';') {
            return 38;
        }

        if (currentChar === ' ') {
            return 18;
        }

        return 32;
    }

    function play(button) {
        if (typeTimeout) {
            clearTimeout(typeTimeout);
        }

        cursorPosition = 0;
        displayText = "";
        var textSpan = createTypingSurface();
        button.disabled = true;
        button.style.display = 'none';

        var type = function() {
            while (cursorPosition < originalHTML.length) {
                var currentChar = originalHTML[cursorPosition];

                if (currentChar === '<') {
                    var tag = '';
                    while (
                        cursorPosition < originalHTML.length &&
                        originalHTML[cursorPosition] !== '>'
                    ) {
                        tag += originalHTML[cursorPosition];
                        cursorPosition++;
                    }

                    if (cursorPosition < originalHTML.length) {
                        tag += '>';
                        cursorPosition++;
                    }

                    displayText += tag;
                    continue;
                }

                displayText += currentChar;
                cursorPosition++;
                textSpan.innerHTML = displayText;
                typeTimeout = setTimeout(type, getDelay(currentChar));
                return;
            }

            textSpan.innerHTML = displayText;
            button.disabled = false;
            button.style.display = '';
            button.textContent = 'play typing animation';
        };

        type();
    }

    function addReplayButton() {
        var button = document.createElement('button');
        button.className = 'typewriter-replay-button';
        button.type = 'button';
        button.textContent = 'play typing animation';
        button.addEventListener('click', function() {
            play(button);
        });

        var pageActions = document.querySelector('.page-actions');

        if (pageActions) {
            pageActions.prepend(button);
        } else {
            element.insertAdjacentElement('afterend', button);
        }
    }

    addTypewriterStyles();
    element.innerHTML = originalHTML;
    addReplayButton();
}

document.addEventListener('DOMContentLoaded', function() {
    var typewriterElement = document.getElementById('typewriter');

    if (typewriterElement) {
        setupTypewriter(typewriterElement);
    }
});
