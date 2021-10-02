const board = document.querySelector('.container')
const colors = ['#016dff', '#528fe2', '#285ea7', '#082b5a', '#aac4e6', '#0061e6']
const SQUARES_NUMBER = 128
const colPixel = document.querySelector('.paintedover span')
const finish = document.querySelector('.hide')
const PixelMinus = document.querySelector('.lefttopaintover span')
let col = 0

PixelMinus.innerHTML = SQUARES_NUMBER
let colPixelMinus = +PixelMinus.innerText

for(let i = 0; i < SQUARES_NUMBER; i++) {
    const square = document.createElement('div')
    square.classList.add('square')

    square.addEventListener('mouseover', setColor)
    square.addEventListener('mouseleave',  removeColor)

    board.append(square)
}

function setColor(event) {
    const element = event.target

    if( element.style.backgroundColor != 'transparent') {
        col++
        colPixelMinus--
    }

    const color = getRandomColor()
    element.style.backgroundColor = 'transparent' //color
    element.style.boxShadow = `0 0 2px ${color}, 0 0 10px ${color}`
    colPixel.innerHTML = col
    PixelMinus.innerHTML = colPixelMinus

   if(col === SQUARES_NUMBER) {
       finish.classList.remove('hide')
   }
}

function removeColor(event) {
    const element = event.target
    element.style.backgroundColor = 'transparent'
    element.style.boxShadow = ``
    element.style.border = `none`
}

function getRandomColor() {
   const index = Math.floor(Math.random() * colors.length)
   return colors[index]
}