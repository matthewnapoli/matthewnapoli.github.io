function setupTypewriter(t)
{
    var HTML = t.innerHTML;
    t.innerHTML = ""
    var cursorPosition = 0;
    writingTag = false;
    firstLineTO = 200;
    normTO = 10;
    firstLine = true;

    speed = normTO;
    

    var type = function()
    {
        if(HTML[0] == "<") {
        t.innerHTML += HTML[cursorPosition]
        cursorPosition++;
        
        if (cursorPosition < HTML.length - 1)
        {
            setTimeout(type, speed);
        }
    };
    return {
        type: type
    };
}

function getOuterTags(htmlString) {
    const regex = /<[^>]+>/g;
    const tags = htmlString.match(regex);

    if (!tags || tags.length < 2) {
        return null; // Not enough tags
    }

    const outerTags = [tags[0], tags[tags.length - 1]];

    return outerTags;
}

var typer = document.getElementById('typewriter');
typewriter = setupTypewriter(typewriter);
typewriter.type("");