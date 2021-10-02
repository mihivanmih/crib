// const people = [
//     {id:1, name: 'Ivan', age: 32},
//     {id:2, name: 'Elena', age: 18},
//     {id:3, name: 'Igor', age: 40},
//     {id:4, name: 'Vlad', age: 22}
// ]
//
// console.table(people);

console.time('timer')
const items = []

for (let i = 0; i <1000000; i++){
    items.push({el: i + 1})
}
console.timeEnd('timer')