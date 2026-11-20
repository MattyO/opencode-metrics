import { rs } from '@rstest/core'

export function withTimeout(promise, ms, message = `Timed out after ${ms}ms`) {
    console.log('racing')
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {console.log('regecting'); reject(new Error(message))}, ms)
    )
  ]);
}

async function sleep(ms){
    await new Promise((r) => setTimeout(r, ms))
}

export function asyncGeneratorMock(){
    let shouldContinue = true
    let items = []
    let onEmptyCallback = () => {}
    let doneWaiting = false
    const doneWaitingPromise = (async () => {
        while(!doneWaiting){ await sleep(50); }
        return 'done'
    })()
    const registerCallback = (callback) => {
        onEmptyCallback = callback
        return doneWaitingPromise
    }

    return {
        callAsyncMock: (args) => {
            items.push(args)
        },
        stopExecution: () => {
            shouldContinue  = false

        },
        onEmpty: registerCallback ,
        subscribeMock:rs.fn().mockReturnValue((async function* () {
        try{


            while(items.length > 0 || shouldContinue == true){
                if(items.length == 0){
                    await sleep(50)
                    continue

                }
                const itemsYielded = items.length > 0

                while(items.length > 0){
                    yield items.pop(0)
                }

                if(itemsYielded){
                    doneWaiting = true
                    onEmptyCallback()
                }

            }
        }catch( err ){
            console.log(err )

        }

        })()),
    }
}
