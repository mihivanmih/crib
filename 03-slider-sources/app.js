const downButton = document.querySelector('.down-button')
const upButton = document.querySelector('.up-button')
const sidebar = document.querySelector('.sidebar')
const mainSlide = document.querySelector('.main-slide')
const container = document.querySelector('.container')
const slidesCount = mainSlide.childElementCount

let activeSlideIndex = 0

sidebar.style.top = `-${(slidesCount - 1) * 100}vh`

upButton.addEventListener('click', () => {
    changeSlide('up')
})

downButton.addEventListener('click', () => {
    changeSlide('down')
})

document.addEventListener('keydown', event => {
    if(event.key === 'ArrowUp' || event.key === 'w'){
        changeSlide('up')
    } else if (event.key === 'ArrowDown' || event.key === 's') {
        changeSlide('down')
    }
})

document.addEventListener("wheel", event => {
    if(event.deltaY > 0) {
        changeSlide('down')
    } else {
        changeSlide('up')
    }
});

function changeSlide(direction) {
    if(direction === 'up'){
        activeSlideIndex++
        if(activeSlideIndex === slidesCount) {
            activeSlideIndex = 0
        }
    } else {
        activeSlideIndex--
        if(activeSlideIndex < 0) {
            activeSlideIndex = slidesCount - 1
        }
    }

    const height = container.clientHeight
    mainSlide.style.transform = `translateY(-${activeSlideIndex * height}px)`
    sidebar.style.transform = `translateY(${activeSlideIndex * height}px)`
}


