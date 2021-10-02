console.log('Request data...')
//
// setTimeout( () => {
//     console.log('Preparing data...')
//
//     const backendData = {
//         server: 'aws',
//         port: 2000,
//         status: 'wokring'
//     }
//
//     setTimeout( () => {
//         backendData.modified = true
//         console.log('Datat received', backendData)
//     }, 2000)
//
// }, 2000)
//
// const p = new Promise( (resolve, reject) => {
//     setTimeout( () => {
//         console.log('Preparing data...')
//         const backendData = {
//         server: 'aws',
//         port: 2000,
//         status: 'wokring'
//     }
//     resolve(backendData)
//     }, 2000)
// })
//
// p.then(data => {
//     //console.log('Promise resolved', data)
//     //const p2 = new Promise((resolve, reject) => {
//     return new Promise((resolve, reject) => {
//         setTimeout(() => {
//             data.modified = true
//             resolve(data)
//         }, 2000)
//     })
// })
//     .then(clientData => {
//     console.log('Data received', clientData)
//     clientData.fromPromise = true
//     return clientData
// }).then( data => {
//     console.log('Modified', data)
// }).catch(err => console.error('Error:', err))
// .finally( () => console.log('Finally'))

const sleep = ms => new Promise(resolve => setTimeout( () => resolve(), ms))

// sleep(2000).then(() => console.log('After 2 sec'))
// sleep(3000).then(() => console.log('After 3 sec'))

//Комбинируем промисы all
Promise.all([sleep(2000), sleep(3000)]).then(() => {
    console.log('All promises')
})

//определить когда 1 промис был выполнен
Promise.race([sleep(2000), sleep(3000)]).then(() => {
    console.log('Race promises')
})














