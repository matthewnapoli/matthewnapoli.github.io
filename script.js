// function setupTypewriter(t)
// {
//     var HTML = t.innerHTML;
//     t.innerHTML = "";
//     var firstLine = HTML.substr(0,12);
//     var theRest = HTML.substr(12)
//     var cursorPosition = 0;
//     var str = "";
//     var string_count = "";
//     var highlight  = '<mark style="background: #ffffff">';
//     var highlight_end = '</mark>';

//     var type = function()
//     {
//         if(cursorPosition < 12) {
//             str = firstLine[cursorPosition]
//         }
//         else {
//             str = theRest
//         }

//         string_count += str
//         processed_string = highlight + string_count + highlight_end
//         t.innerHTML = processed_string
//         cursorPosition++;
        
//         if (cursorPosition < HTML.length - 1)
//         {
//             setTimeout(type, 200);
//         }
//     };
//     return {
//         type: type
//     };
// }

// var typer = document.getElementById('typewriter');
// typewriter = setupTypewriter(typewriter);
// typewriter.type();