import _ from "lodash";
import fs from "fs";

interface PersonData {
    firstName: string,
    lastName: string
}
interface WithFamily {
    family: FamilyMember[]
}
type Person = PersonData & Contactable & WithFamily

interface FamilyMemberData {
    name: String,
    birth: String,
}
type FamilyMember = Contactable & FamilyMemberData

interface Contactable {
    phone?: PhoneData,
    address?: AddressData
}
interface PhoneData {
    mobile: String,
    landline: String
}
interface AddressData {
    street: String,
    city: String,
    postalCode: String
}

/*
    Unclear to me if:
    * Repeated children (besides F) should overwrite, throw, or generate multiples (selected overwrite)
    * T/A can be in any order (assumed yes)
    * Just how high effort this should be - made some comments on things I know aren't top tier
 */
const inputFile = process.argv[2];
const input = fs.readFileSync(inputFile);

// Takes the initial letter, and the prop names
// Returns parser, which in turns returns {prop: value, ...} type Record<String,String> like objects and optionally forces type
const lineParser = <T>(initial: string, props: string[]) => {
    return (line: String) => {
        const [actualInitial, ...values] = line.split("|");
        if(actualInitial !== initial) {
            throw new Error(`Initial letter is ${actualInitial}, but expected ${initial}`)
        }
        if(values.length > props.length) {
            throw new Error(`Expected at most ${props.length} values but found ${values.length}`)
        }

        // Not enough of a type ninja to do this completely type safely
        return _.zipObject(props, values) as T;
    }
}

const parsers = {
    person: (line: string) : Person => {
        const personData = lineParser<PersonData>("P", ["firstName", "lastName"])(line);
        return {...personData, family: [] as FamilyMember[]}
    },
    familyMember: lineParser<FamilyMember>("F", ["name", "born"]),
    address: lineParser<AddressData>("A", ["street", "city", "postalCode"]),
    phone: lineParser<PhoneData>("T", ["mobile", "landline"])
}

const people = input.toString()
    .split('\n')
    .reduce((people, line) => {
        if(line.length === 0) {
            throw new Error('Empty line');
        }

        const lastPerson = people.length === 0 ? null : people.slice(-1)[0];
        const lastFamilyMember = (lastPerson === null || lastPerson.family.length === 0) ? null : lastPerson.family.slice(-1)[0];

        const initialChar = line[0];
        switch (initialChar) {
            case "P":
                const newPerson = parsers.person(line);
                return [...people, newPerson];
            case "F":
                if(lastPerson === null) {
                    throw new Error('Cannot add family to nonexistant person');
                }
                const newFamilyMember = parsers.familyMember(line);

                // Thought I was going to do this without mutation but benefit minimal - skipped for brevity
                lastPerson.family = [...lastPerson.family, newFamilyMember];

                return people;
            case "T":
                const newPhoneNumber = parsers.phone(line);
                if(lastFamilyMember !== null) {
                    lastFamilyMember.phone = newPhoneNumber; 
                    return people;
                }
                if(lastPerson !== null) {
                    lastPerson.phone = newPhoneNumber;
                    return people;
                }
                throw new Error('Cannot add phone number to nonexistant person/family');
            case "A":
                const newAddress = parsers.address(line);
                if(lastFamilyMember !== null) {
                    lastFamilyMember.address = newAddress;
                    return people;
                }
                if(lastPerson !== null) {
                    lastPerson.address = newAddress;
                    return people;
                }
                throw new Error('Cannot add address to nonexistant person/family');
            default:
                throw new Error(`Unknown initial character ${initialChar}`);
        }
    }, [] as Person[]);

// Figured you did not want me to simply import a library
const toXml = (tree: Record<string,unknown>): string => {
    if(!_.isPlainObject(tree))
        throw new Error("That's a pretty exotic object");

    JSON.stringify(tree); // Throws TypeError if cyclical
    
    return Object.entries(tree).reduce((previousSibilingsXml, [key, val]) => {
        if(Array.isArray(val)) { // We are simply dumping them all on the same level, as in the example
            return previousSibilingsXml + val.map(toXml).map(subXml => `<${key}>${subXml}</${key}>`).join("\n"); // Not sanitizing keys for control characters
        }
        if(_.isPlainObject(val)) { // Not sure if there's a better type here. 
            return previousSibilingsXml + `<${key}>${toXml(val as Record<string, unknown>)}</${key}>`;
        }
        if(_.isString(val)) {
            return previousSibilingsXml + `<${key}>${val}</${key}>`; 
        }
        //Otherwise simply ignored
        return previousSibilingsXml;
    }, ``)
}

console.log(`<people>${toXml({person: people})}</people>`);