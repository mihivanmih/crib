// Dependency inversion principle

class Fetch {
    request() {
        //return fetch(url).then(r => r.json())
        return Promise.resolve('data from fetch')
    }
}

class LocalStorage {
    get() {
        const dataFromLocalStorage = 'data from local storage'
       // return localStorage.getItem('key')
        return dataFromLocalStorage
    }
}

class FetchClient  {
    constructor() {
        this.fetch = new Fetch()
    }

    clientGet(key) {
       return  this.fetch.request('vk.com')
    }
}

class LocalStorageClient {
    constructor(client) {
        this.localStorage = new LocalStorage()
    }

    clientGet(key) {
        return this.localStorage.get()
    }

}

class Database {
    constructor(client) {
        this.client = client
    }

    getData(key) {
        return this.client.clientGet(key)
    }

}

const db = new Database(new LocalStorageClient())

console.log(db.getData('rand'));