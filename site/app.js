// const rightBtn = document.querySelector('.click_right')
// const leftBtn = document.querySelector('.click_left')
// const upBtn = document.querySelector('.click_up')
// const bottomBtn = document.querySelector('.click_bottom')
// const slides = document.querySelectorAll('.slide')
//
//
//
//
//
// //подсчитываем каких слайдов сколько
// let leftCountSlider = rightCountSlider = toptCountSlider = bottomCountSlider = 0
//
// for (let slide of slides) {
//     switch (slide.attributes['data-direction'].value) {
//         case 'left' : leftCountSlider++
//             break
//         case 'right' : rightCountSlider++
//             break
//         case 'top' : toptCountSlider++
//             break
//         case 'bottom' : bottomCountSlider++
//             break
//     }
// }
//
// console.log('leftCountSlider', leftCountSlider)
// console.log('rightCountSlider', rightCountSlider)
// console.log('toptCountSlider', toptCountSlider)
// console.log('bottomCountSlider', bottomCountSlider)
//
//
// let slideActiveItem = document.querySelector('.slide active')
//
//
//
// let activeSlideIndex = 0
//
// //проверяем на каком мы слайде, если ни кна каком, то это первый
//
// if(true) {
//
// }
//
// slides[activeSlideIndex].classList.add("active")
//
//
// //const slideActive = +document.querySelector('.slide.active').attributes['data-id'].value
//
//
//
// rightBtn.addEventListener("click", event => {
//     const id = rightBtn.attributes['data-id'].value
//     assembly(id, `right`)
// })
//
// leftBtn.addEventListener("click", event => {
//     const id = leftBtn.attributes['data-id'].value
//     assembly(id, `left`)
// })
//
// upBtn.addEventListener("click", event => {
//     const id = upBtn.attributes['data-id'].value
//     assembly(id, `top`)
// })
//
// bottomBtn.addEventListener("click", event => {
//     const id = bottomBtn.attributes['data-id'].value
//     assembly(id, `bottom`)
// })
//
//
// //собираем функции клика
// function assembly(id, direction) {
//
//     switch (direction) {
//         case 'right': animationSlideRight()
//             break
//         case 'left': animationSlideLeft()
//             break
//         case 'top': animationSlideUp()
//             break
//         case 'bottom': animationSlideBottom()
//             break
//     }
//
//     removeClassAll()
//    // removeClassActive()
//     slides[id].classList.add("active")
// }
//
//
//
// //находим номер активного слайд
// function slideActive() {
//     return +document.querySelector('.slide.active').attributes['data-id'].value
// }
//
// // удаляем активный класс
// function removeClassActive() {
//     return slides[slideActive()].classList.remove('active')
// }
// // удаляем лишнии классы у всех
// function removeClassAll() {
//     col = 0
//     for (let slide of slides) {
//         col++
//         slide.className = `slide slide${col}`
//     }
//     //return slides[id].className = `slide slide${id}`
// }
//
//
//
// // анимация уезда слайда вправо
// function animationSlideRight() {
//     return slides[slideActive()].classList.add("animation_right")
// }
// // анимация уезда слайда влево
// function animationSlideLeft() {
//     return slides[slideActive()].classList.add("animation_left")
// }
// // анимация уезда слайда снизу вверх
// function animationSlideUp() {
//     return slides[slideActive()].classList.add("active_up")
// }
// // анимация уезда слайда сверху вниз
// function animationSlideBottom() {
//     return slides[slideActive()].classList.add("active_bottom")
// }
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
// /*
// const downButton = document.querySelector('.down-button')
// const upButton = document.querySelector('.up-button')
// const sidebar = document.querySelector('.sidebar')
// const mainSlide = document.querySelector('.main-slide')
// const container = document.querySelector('.container')
// const slidesCount = mainSlide.childElementCount
//
// let activeSlideIndex = 0
//
// sidebar.style.top = `-${(slidesCount - 1) * 100}vh`
//
// upButton.addEventListener('click', () => {
//     changeSlide('up')
// })
//
// downButton.addEventListener('click', () => {
//     changeSlide('down')
// })
//
// document.addEventListener('keydown', event => {
//     if(event.key === 'ArrowUp' || event.key === 'w'){
//         changeSlide('up')
//     } else if (event.key === 'ArrowDown' || event.key === 's') {
//         changeSlide('down')
//     }
// })
//
// document.addEventListener("wheel", event => {
//     if(event.deltaY > 0) {
//         changeSlide('down')
//     } else {
//         changeSlide('up')
//     }
// });
//
// function changeSlide(direction) {
//     if(direction === 'up'){
//         activeSlideIndex++
//         if(activeSlideIndex === slidesCount) {
//             activeSlideIndex = 0
//         }
//     } else {
//         activeSlideIndex--
//         if(activeSlideIndex < 0) {
//             activeSlideIndex = slidesCount - 1
//         }
//     }
//
//     const height = container.clientHeight
//     mainSlide.style.transform = `translateY(-${activeSlideIndex * height}px)`
//     sidebar.style.transform = `translateY(${activeSlideIndex * height}px)`
// }
//
//
// */



const fff =  document.querySelector(".fff").innerHTML = document.querySelector(".fff").innerHTML.toUpperCase()
console.log("dsddsd", fff)