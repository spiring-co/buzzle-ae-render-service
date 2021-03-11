import fetch from 'node-fetch'
export default async()=>{
    return {
        instanceId:await(await fetch('http://169.254.169.254/latest/meta-data/instance-id')).text(),
        ipv4:await(await fetch('http://169.254.169.254/latest/meta-data/public-ipv4')).text()
    }
}