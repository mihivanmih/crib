function hello() {
    console.log('Hello', this)
}

const person = {
    name: 'Vladilen',
    age: 25,
    sayHello: hello,
    sayHelloWindow: hello.bind(document),
    logInfo: function (job, phone) {
        console.group(`${this.name} info:`)
        console.log(`Name is ${this.name}`)
        console.log(`Age is ${this.age}`)
        console.log(`Job is ${job}`)
        console.log(`Phone is ${phone}`)
        console.groupEnd()
    }
}

const lena = {
    name: 'Elena',
    age: 23
}

/*
const fnLenaInfoLog = person.logInfo.bind(lena, 'Frontend', '8-800-355-45-45')
fnLenaInfoLog()

const fnLenaInfoLog = person.logInfo.bind(lena)
fnLenaInfoLog('Frontend', '8-800-355-45-45')
*/

//person.logInfo.bind(lena, 'Frontend', '8-800-355-45-45')()
//person.logInfo.call(lena, 'Frontend', '8-800-355-45-45') //call сразу вызывает функцию
person.logInfo.apply(lena, ['Frontend', '8-800-355-45-45'])  // передаем 2 параметра, второй массив

const array = [1, 2, 3, 4, 5]

//function multiply(array, number) {
//     return array.map( (item) => {
//         return item * number
//    })
//}

Array.prototype.multBy = function (number) {
    return this.map((item) => {
        return item * number
    })
}

console.log(array.multBy(2));


//console.log(multiply(array, 5));




























