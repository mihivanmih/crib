const delay = ms => {
    return new Promise(r => setTimeout(() => r(), ms))
}

const url = "https://jsonplaceholder.typicode.com/todos"

// function fetchTodos() {
//     console.log('Fetch todo started...')
//     return delay(2000)
//         .then(() => fetch(url))
//         .then(response => response.json())
// }
//
// fetchTodos()
//     .then(data => {
//         console.log('Data:', data)
//     })
//     .catch(e => console.error(e))


async function fetchAsyncTodos() {
    console.log('Fetch todo started...')
    try {
        await delay(2000) //пока не выполнится не перейдет на другую строчку qwait
        const response = await fetch(url) //если что то возвращает записываем в переменную
        const data = await response.json()
        console.log('Data:', data)
    } catch (e) {
        console.error(e)
    } finally {
        console.log('Finally')
    }

}

fetchAsyncTodos()