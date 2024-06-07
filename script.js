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
        if(cursorPosition < 13) {
            speed = firstLineTO;
        } else {
            speed = normTO;
        }

        if(HTML[cursorPosition] == "<"){
            dealWTag()
        } else {
            t.innerHTML += HTML[cursorPosition]
            cursorPosition++;
        }


        if (cursorPosition < HTML.length - 1)
        {
            setTimeout(type, speed);
        }
    };

    var dealWTag = function() { 
        tag = "";
            for(i = cursorPosition; HTML[cursorPosition] != ">"; cursorPosition++){
                tag += HTML[cursorPosition];
            }
            tag += HTML[cursorPosition]
            t.innerHTML += tag;
            console.log(tag)
            cursorPosition++;
    }


    return {
        type: type
    };
}

var typer = document.getElementById('typewriter');
typewriter = setupTypewriter(typewriter);
typewriter.type();