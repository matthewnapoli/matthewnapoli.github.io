function setupTypewriter(t)
{
    var HTML = t.innerHTML;
    t.innerHTML = "";
    var cursorPosition = 0,
        tag = "",
        writingTag = false,
        tagOpen = false,
        firstLineSpeed = 200,
        typeSpeed = 9,
        firstLine = true;
        tempTypeSpeed = 0;

    var type = function()
    {
        if (writingTag === true)
        {
            tag += HTML[cursorPosition];
        }
        if (HTML[cursorPosition] === "<")
        {
            tempTypeSpeed = 0;
            if (tagOpen)
            {
                tagOpen = false;
                writingTag = true;
            }
            else
            {
                tag = "";
                tagOpen = true;
                writingTag = true;
                tag += HTML[cursorPosition];
            }
        }

        if (!writingTag && tagOpen)
        {
            const nextChars = HTML.substring(cursorPosition, cursorPosition + 5); // Extract the next 5 characters
            if (nextChars === "&amp;")
            {
                tag.innerHTML += "&";   
                cursorPosition += 4; // Skip to the end of "&amp;" (length of "&amp;" is 5, but we want to move cursor 4 positions)
            }
            else
            {
                tag.innerHTML += HTML[cursorPosition];
            }
        }

        if (!writingTag && !tagOpen)
        {
            if(firstLine == true && cursorPosition <= 12)
            {
                tempTypeSpeed = (Math.random() * typeSpeed) + firstLineSpeed;
                if(cursorPosition > 12)
                {
                    firstLine = false
                }

            }
            else
            {
                tempTypeSpeed = (Math.random() * typeSpeed) + 7;
            }
            const nextChars = HTML.substring(cursorPosition, cursorPosition + 5); // Extract the next 5 characters
            if (nextChars === "&amp;")
            {
                t.innerHTML += "&";
                cursorPosition += 4; // Skip to the end of "&amp;" (length of "&amp;" is 5, but we want to move cursor 4 positions)
            }
            else
            {
                t.innerHTML += HTML[cursorPosition];
            }
        }
        
        if (writingTag === true && HTML[cursorPosition] === ">")
        {
            tempTypeSpeed = (Math.random() * typeSpeed) + 7;
            writingTag = false;
            if (tagOpen)
            {
                var newSpan = document.createElement("span");
                t.appendChild(newSpan);
                newSpan.innerHTML = tag;
                tag = newSpan.firstChild;
            }
        }
        cursorPosition += 1;
        if (cursorPosition < HTML.length - 1)
        {
            setTimeout(type, tempTypeSpeed);
        }
    };
    return {
        type: type
    };
}

var typer = document.getElementById('typewriter');
typewriter = setupTypewriter(typewriter);
typewriter.type();