from utils.planning_center import get_people

people = get_people(10)

print(f"Pulled {len(people)} people")

for person in people:
    print(person)