export class State {
    constructor() {
        this.people = [
            this.createPerson('p1', 'Person 1')
        ];
        this.activePersonId = 'p1';
        this.mode = 'week'; // 'week' or 'date'
        this.startDate = new Date();
        this.duration = 1; // Default duration in hours
        this.onUpdate = null;
    }

    setDuration(hours) {
        this.duration = parseInt(hours);
        this.notify();
    }

    createPerson(id, name) {
        return {
            id,
            name,
            weeklyAvailability: this.createEmptyGrid(),
            // Map key: YYYY-MM-DD (start date of the week) -> Grid
            dateAvailability: {}
        };
    }

    setMode(mode) {
        this.mode = mode;
        this.notify();
    }

    setStartDate(date) {
        this.startDate = new Date(date);
        this.notify();
    }

    createEmptyGrid() {
        // 7 days, 24 hours
        return Array(7).fill(0).map(() => Array(24).fill(false));
    }

    get activePerson() {
        return this.people.find(p => p.id === this.activePersonId);
    }

    getPersonGrid(person) {
        if (this.mode === 'week') {
            return person.weeklyAvailability;
        } else {
            const key = this.startDate.toISOString().split('T')[0];
            if (!person.dateAvailability[key]) {
                person.dateAvailability[key] = this.createEmptyGrid();
            }
            return person.dateAvailability[key];
        }
    }

    get activeGrid() {
        return this.getPersonGrid(this.activePerson);
    }

    toggleSlot(day, hour) {
        const grid = this.activeGrid;
        grid[day][hour] = !grid[day][hour];
        this.notify();
    }

    clearActive() {
        const person = this.activePerson;
        if (this.mode === 'week') {
            person.weeklyAvailability = this.createEmptyGrid();
        } else {
            const key = this.startDate.toISOString().split('T')[0];
            person.dateAvailability[key] = this.createEmptyGrid();
        }
        this.notify();
    }

    addPerson() {
        const id = `p${this.people.length + 1}`;
        this.people.push(this.createPerson(id, `Person ${this.people.length + 1}`));
        this.activePersonId = id;
        this.notify();
    }

    switchPerson(id) {
        this.activePersonId = id;
        this.notify();
    }

    getHeatmapData() {
        const density = Array(7).fill(0).map(() => Array(24).fill(0));
        this.people.forEach(person => {
            const grid = this.getPersonGrid(person);
            grid.forEach((day, dIdx) => {
                day.forEach((slot, hIdx) => {
                    if (slot) density[dIdx][hIdx]++;
                });
            });
        });
        return {
            density,
            max: this.people.length
        };
    }

    notify() {
        if (this.onUpdate) this.onUpdate();
    }
}
