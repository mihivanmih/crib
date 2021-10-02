/*document.addEventListener('DOMContentLoaded', () => {

})*/

const num1 = document.querySelector('#num1')
const num2 = document.querySelector('#num2')
const addBtn = document.querySelector('#add')
const subBtn = document.querySelector('#sub')
const output = document.querySelector('#output')

const getInputValue = () => {
    const value1 = +num1.value
    const value2 = +num2.value
    return [value1, value2]
}

const addHandler = () => {
    const values = getInputValue()
    const result = values[0] + values[1]
    displayResult(result)
}

const subHandler = () => {
    //debugger
    const values = getInputValue()
    const result = values[0] - values[1]
    displayResult(result)
}

const displayResult = (result) => {
    output.closest('.card').style.display = 'block'
    output.innerHTML = `Результат = ${result}`
    console.trace()
}

addBtn.addEventListener('click', addHandler)
subBtn.addEventListener('click', subHandler)

//в консоле можно обращаться к элементу через $0 -1,2,3,4,5
// или находить все через $('.cards') как в jquery


setTimeout( () => {
    fetch('https://jsonplaceholder.typicode.com/todos/1')
        .then(response => response.json())
        .then(json => console.log(json))
}, 5000)