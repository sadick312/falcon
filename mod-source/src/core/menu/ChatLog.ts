/** One line in the menu's chat log. */
export class ChatLog {
    time: string;
    type: "chat" | "encounter" | "leave" | "death" = "chat";

    constructor(
        public msg: string,
        type?: "encounter" | "leave" | "death"
    ) {
        if (type) this.type = type;

        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";

        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutesStr = minutes < 10 ? "0" + minutes : minutes;

        this.time = `${hours}:${minutesStr} ${ampm}`;
    }
}
