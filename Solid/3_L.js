// // Liskov substitution principle
//
// class Person {
//
// }
//
// class Member extends Person{
//     access() {
//         console.log("У тебя есть доступ")
//     }
// }
//
// class Guest {
//     isGuest = true
// }
//
// class Frontend extends Member{
//     canCreateFrontend() {
//
//     }
// }
//
// class Backend extends Member{
//     canCreateBackend() {
//
//     }
// }
//
// class PersonFromDifferentCompany extends Guest{
//     access() {
//         throw new Error('У тебя нет доступа')
//     }
// }
//
// function openSecretDoor(member) {
//     member.access()
// }
//
// openSecretDoor(new Frontend())
// openSecretDoor(new Backend())
// //openSecretDoor(new PersonFromDifferentCompany())

// ===================

class Component {
    isComponent = true
}

class ComponentWithTemplate extends Component{
    render() {
        return `<div>Component</div>`
    }
}

class HigherOrderComponent extends Component{

}

class HeaderComponent extends ComponentWithTemplate{
    onInit() {}
}

class FooterComponent extends ComponentWithTemplate{
    afterInit() {}
}

class HOC extends HigherOrderComponent{
    render() {
        throw new Error('Нельзя рендерить')
    }

    wrapComponent(component) {
        component.wrapped = true
        return component
    }
}

function renderComponent(component) {
    console.log(component.render())
}

renderComponent(new HeaderComponent())
renderComponent(new FooterComponent())
//renderComponent(new HOC())











