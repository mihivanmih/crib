// function createCalcFunction(n) {
//     return function () {
//         console.log(1000 * n)
//     }
// }
//
// const calc = createCalcFunction(42)
// console.log(calc);
// calc()

// function createIncrementor(n) {
//     return function (num) {
//         return n + num
//     }
// }
//
// const addOne = createIncrementor(1)
// const addTen = createIncrementor(10)
//
// console.log(addOne(10));
// console.log(addTen(10));


// function urlGenerator(domain) {
//     return function (url) {
//         return `https://${url}.${domain}`
//     }
// }
//
// const comUrl = urlGenerator('com')
// const ruUrl = urlGenerator('ru')
//
// console.log(comUrl('google'));
// console.log(ruUrl('google'));

function logPerson() {
    console.log(`Person: ${this.name},  ${this.age},  ${this.job}, `)
}

// const person1 = {name: "Михаил", age: 22, job: "Frontend"}
//
//
// bind(person1, logPerson)

function bind(context, fn) {
    return function (...args) {
        fn.apply(context, args)
    }
}

const person1 = {name: "Михаил", age: 22, job: "Frontend"}

bind(person1, logPerson)()