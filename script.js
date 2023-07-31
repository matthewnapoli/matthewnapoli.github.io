// Function to set up the typewriter effect
function setupTypewriter(t) {
    var HTML = t.innerHTML;
  
    t.innerHTML = "";
  
    var cursorPosition = 0,
        tag = "",
        writingTag = false,
        tagOpen = false,
        typeSpeed = 25,
        tempTypeSpeed = 0;
  
    var type = function() {
      if (writingTag === true) {
        tag += HTML[cursorPosition];
      }
  
      if (HTML[cursorPosition] === "<") {
        tempTypeSpeed = 0;
        if (tagOpen) {
          tagOpen = false;
          writingTag = true;
        } else {
          tag = "";
          tagOpen = true;
          writingTag = true;
          tag += HTML[cursorPosition];
        }
      }
  
      if (!writingTag && tagOpen && HTML[cursorPosition] == "&") {
        tag.innerHTML += "&";
        cursorPosition+=4
      }

      if (!writingTag && tagOpen && HTML[cursorPosition] != "&") {
        tag.innerHTML += HTML[cursorPosition]
      }


  
      if (!writingTag && !tagOpen) {
        if (HTML[cursorPosition] === " ") {
          tempTypeSpeed = 0;
        } else {
          tempTypeSpeed = typeSpeed;
        }
        t.innerHTML += HTML[cursorPosition];
      }
  
      if (writingTag === true && HTML[cursorPosition] === ">") {
        tempTypeSpeed = typeSpeed;
        writingTag = false;
        if (tagOpen) {
          var newSpan = document.createElement("span");
          t.appendChild(newSpan);
          newSpan.innerHTML = tag;
          tag = newSpan.firstChild;
        }
      }
  
      cursorPosition += 1;
      if (cursorPosition < HTML.length - 1) {
        setTimeout(type, tempTypeSpeed);
      }
    };
  
    return {
      type: type,
    };
  }
  
  // Function to handle the image replacement
  function replaceImage() {
    var imagePlaceholder = document.querySelector(".image-placeholder");
    var uclaImage = document.createElement("img");
    uclaImage.src = "img/bruin-logo.png";
    uclaImage.alt = "UCLA Bruins Logo";
    uclaImage.style.width = "24px";
    uclaImage.style.height = "24px";
    uclaImage.style.marginBottom = "-4px";
    imagePlaceholder.appendChild(uclaImage);
  }
  
  // Entry point: set up typewriter and replace the image
  document.addEventListener("DOMContentLoaded", function () {
    var typer = document.getElementById("typewriter");
    var typewriter = setupTypewriter(typer);
    typewriter.type();
  
    replaceImage();
  });
  