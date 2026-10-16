export interface Work {id:string;slot:number;index:number;name:string;title:string;width:number;height:number;image:string;video:string;demo:boolean}
export interface Gallery {id:string|null;createdAt?:string;works:Work[];groups:{id:number;target:string;ids:string[];sourceIds?:string[]}[]}
export interface Submission {id:string;slot_id:number;name:string;title:string;image_key:string;video_key:string;width:number;height:number;duration:number;status:string;active:number;feedback:string;demo:number;created_at:string}
