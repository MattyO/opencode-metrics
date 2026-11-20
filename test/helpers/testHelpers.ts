import { rs } from '@rstest/core'

export function withTimeout(promise, ms, message = `Timed out after ${ms}ms`) {
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

    return {
        yieldItem: (args) => {
            items.push(args)
        },

        stopExecution: () => {
            shouldContinue == false
            return (async () => {
                while(items.length > 0){
                    await sleep(50);
                }
            })()
        },

        subscribeMock: rs.fn().mockReturnValue((async function* () {
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
                }
            }catch( err ){
                console.log(err )
            }
        })()),
    }
}
