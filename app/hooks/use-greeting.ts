import { useState, useEffect } from "react";

export const useGreeting = () => {
    const [greeting, setGreeting] = useState("Good morning");

    useEffect(() => {
        const updateGreeting = () => {
            const currentHour = new Date().getHours();

            if (currentHour < 12) {
                setGreeting("Good morning");
            } else if (currentHour < 18) {
                setGreeting("Good afternoon");
            } else {
                setGreeting("Good evening");
            }
        };

        updateGreeting();

        // Check every minute to update the greeting if the time crosses a boundary
        const interval = setInterval(updateGreeting, 60000);
        return () => clearInterval(interval);
    }, []);

    return greeting;
};
